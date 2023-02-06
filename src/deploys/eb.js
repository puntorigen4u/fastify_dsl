/**
* EB Deploy: A class to help deploy vue_dsl to AWS EB.
* @name 	eb
* @module 	eb
**/
import base_deploy from './base_deploy'

export default class eb extends base_deploy {

    constructor({ context={} }={}) {
        super({ context, name:'AWS EB' });
    }

    async logo() {
        let asciify = require('asciify-image'), path = require('path');
        let aws = path.join(__dirname,'assets','aws.png');
        let logo_txt = await asciify(aws, 
            { 
                fit:'width',
                width:25
            }
        );
        console.log(logo_txt);
    }

    async base_build() {
        // builds the project
        let ci = require('ci-info');
        let spawn = require('await-spawn'), path = require('path'), fs = require('fs').promises;
        //let ora = require('ora');
        let node_modules_final = path.join(this.context.x_state.dirs.app,'node_modules');
        let node_package = path.join(this.context.x_state.dirs.app,'package.json');
        let npm={}, errors=[];
        this.context.x_console.outT({ message:`Building project`, color:'cyan' });
        let spinner = this.context.x_console.spinner({ message:'Building project' });
        let node_modules_exist = await this.exists(node_modules_final);
        let node_package_exist = await this.exists(node_package);
        if (node_modules_exist && node_package_exist) {
            //test if every package required is within node_modules
            spinner.start(`Some npm packages where installed; checking ..`);
            let pkg = JSON.parse(((await fs.readFile(node_package, 'utf-8'))));
            let all_ok = true;
            for (let pk in pkg.dependencies) {
                let tst_dir = path.join(this.context.x_state.dirs.app,'node_modules',pk);
                let tst_exist = await this.exists(tst_dir);
                if (!tst_exist) all_ok = false;
            } 
            node_modules_exist=all_ok;
            if (all_ok) {
                spinner.succeed('Using existing npm packages');
            } else {
                spinner.warn('Some packages are new, requesting them');
            }
        }
        // issue npm install (400mb)
        if (!node_modules_exist) {
            spinner.start(`Installing npm packages`);
            //this.x_console.outT({ message:`Installing npm packages` });
            try {
                npm.install = await spawn('npm',['install'],{ cwd:this.context.x_state.dirs.app }); //, stdio:'inherit'
                spinner.succeed(`npm install succesfully`);
            } catch(n) { 
                npm.install=n; 
                spinner.fail('Error installing npm packages');
                errors.push(n);
            }
        }
        // issue npm run build (just docs; not working on CI 16-jun-21)
        if (ci.isCI==false) {
            spinner.start(`Building NodeJS project`);
            try {
                npm.build = await spawn('npm',['run','build'],{ cwd:this.context.x_state.dirs.app });
                spinner.succeed('Project built successfully');
            } catch(nb) { 
                npm.build = nb; 
                spinner.fail('Build failed');
                if (ci.isCI==false) {            
                    this.context.x_console.out({ message:`Building NodeJS again to show error in console`, color:'red' });
                    //build again with output redirected to console, to show it to user
                    try {
                        console.log('\n');
                        npm.build = await spawn('npm',['run','dev'],{ cwd:this.context.x_state.dirs.app, stdio:'inherit', timeout:15000 });
                    } catch(eg) {
                    }
                }
                errors.push(nb);
            }
        }
        return errors;
    }

    async deploy() {
        let build={};
        this.context.x_console.title({ title:'Deploying to Amazon AWS Elastic Bean', color:'green' });
        await this.logo();
        // builds the app
        build.try_build = await this.base_build(); 
        if (build.try_build.length>0) {
            this.context.x_console.outT({ message:`There was an error building the project.`, color:'red' });
            return false;
        }
        // deploys to aws
        build.deploy_aws_eb = await this.run(); //test if results.length>0 (meaning there was an error)
        if (build.deploy_aws_eb.length>0) {
            this.context.x_console.outT({ message:`There was an error deploying to Amazon AWS.`, color:'red', data:build.deploy_aws_eb.toString()});
            return false;
        }
        return true;
    }

    async _createEBx_configEB() {
        // create config.yml content for defining EB instance
        let eb_full = this.context.x_state.central_config.deploy.replaceAll('eb:','');
        let eb_appname = eb_full;
        let eb_instance = `${eb_appname}-dev`;
        if (eb_full.includes(',')) {
            eb_appname = eb_full.split(',')[0];
            eb_instance = eb_full.split(',').splice(-1)[0];
        }
        // create YAML
        let yaml = require('yaml');
        let data = {
            'branch-defaults': {
                master: {
                    environment: eb_instance,
                    group_suffix: null
                }
            },
            global: {
                application_name: eb_appname,
                branch: null,
                default_ec2_keyname: 'aws-eb',
                default_platform: 'Node.js',
                default_region: 'us-east-1',
                include_git_submodules: true,
                instance_profile: null,
                platform_name: null,
                platform_version: null,
                profile: null,
                repository: null,
                sc: 'git',
                workspace_type: 'Application'
            }
        };
        if (this.context.x_state.config_node.aws.region) {
            data.global.default_region = this.context.x_state.config_node.aws.region;
        }
        //write
        let path = require('path');
        let eb_base = this.context.x_state.dirs.app;
        let eb_dir = path.join(eb_base,'.elasticbeanstalk');
        await this.context.writeFile(path.join(eb_dir,'config.yml'),yaml.stringify(data, { version:'1.1' }));
    }

    async _createEBx_configNode() {
        // create 01_confignode content for setting ENV vars within EB instance
        let yaml = require('yaml');
        let data = {
            option_settings: {
                'aws:elasticbeanstalk:application:environment' : {
                    APP_PORT: this.context.x_state.central_config.port,
                    CLUSTER: 1,
                    START_TYPE: 'production'
                }
            }
        };
        //instancetype
        if (this.context.x_state.central_config.instance_type) {
            data.option_settings.container_commands = {
                'aws:autoscaling:launchconfiguration': {
                    InstanceType: this.context.x_state.central_config.instance_type
                }
            };  
        }
        //port
        if (this.context.x_state.central_config.port!=8081) {
            data.container_commands = {
                '00_remove_redirect_http': {
                    command: 'sudo iptables -t nat -D PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 8080'
                },
                '01_add_redirect_http': {
                    command: `sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port ${this.context.x_state.central_config.port}`
                }
            };
            data.option_settings['aws:elasticbeanstalk:environment'] = {
                EnvironmentType: 'SingleInstance'
            };
        }
        //stage & env_variables
        if (this.context.x_state.central_config.stage && this.context.x_state.central_config.stage!='') {
            data.option_settings['aws:elasticbeanstalk:application:environment'].STAGE = this.context.x_state.central_config.stage;
            if (this.context.x_state.central_config.stage!='dev') {
                data.option_settings['aws:elasticbeanstalk:application:environment'].START_TYPE = this.context.x_state.central_config.stage;
            }
        }
        for (let key in this.context.x_state.config_node) {
            // omit special config 'reserved' (aurora,vpc,aws) node keys
            if (!['copiar'].includes(key) && typeof this.context.x_state.config_node[key] === 'object') {
                Object.keys(this.context.x_state.config_node[key]).map(function(attr) {
                    if (attr.charAt(0)!=':') data.option_settings['aws:elasticbeanstalk:application:environment'][key.toUpperCase()+'_'+attr.toUpperCase()] = this.context.x_state.config_node[key][attr];
                }.bind(this));
            }
        }
        //write
        let path = require('path');
        let eb_base = this.context.x_state.dirs.app;
        let eb_dir = path.join(eb_base,'.ebextensions');
        await this.context.writeFile(path.join(eb_dir,'01_confignode.config'),yaml.stringify(data, { version:'1.1' }));
    }

    async _createEBx_timeout() {
        // create 01_confignode content for setting ENV vars within EB instance
        if (this.context.x_state.central_config.timeout) {
            let yaml = require('yaml');
            let data = {
                container_commands: {
                    extend_proxy_timeout: {
                        command: 
`sed -i '/\\s*location \\/ {/c \\
        client_max_body_size 500M; \\
        location / { \\
                proxy_connect_timeout       ${this.context.x_state.central_config.timeout};\\
                proxy_send_timeout          ${this.context.x_state.central_config.timeout};\\
                proxy_read_timeout          ${this.context.x_state.central_config.timeout};\\
                send_timeout                ${this.context.x_state.central_config.timeout};\\
        ' /tmp/deployment/config/#etc#nginx#conf.d#00_elastic_beanstalk_proxy.conf`
                    }
                }
            };
            //write
            let path = require('path');
            let eb_base = this.context.x_state.dirs.app;
            let eb_dir = path.join(eb_base,'.ebextensions');
            await this.context.writeFile(path.join(eb_dir,'extend-proxy-timeout.config'),yaml.stringify(data)); //, { version:'1.1' }
        }
    }

    async _createEBx_sockets() {
        // create enable-websockets.config
        let yaml = require('yaml');
        let data = {
            container_commands: {
                enable_websockets: {
                    command: 
`sed -i '/\s*proxy_set_header\s*Connection/c \
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection ""upgrade"";\
        ' /tmp/deployment/config/#etc#nginx#conf.d#00_elastic_beanstalk_proxy.conf`
                }
            }
        };
        //write
        let path = require('path');
        let eb_base = this.context.x_state.dirs.app;
        let eb_dir = path.join(eb_base,'.ebextensions');
        await this.context.writeFile(path.join(eb_dir,'enable-websockets.config'),yaml.stringify(data, { version:'1.1' }));
    }

    async _createEBx_puppeteer() {
        // create puppeteer.config (chromium support)
        let yaml = require('yaml');
        let data = {
            container_commands: {
                install_chrome: {
                    command: 'curl https://intoli.com/install-google-chrome.sh | bash'
                }
            }
        };
        //write
        let path = require('path');
        let eb_base = this.context.x_state.dirs.app;
        let eb_dir = path.join(eb_base,'.ebextensions');
        await this.context.writeFile(path.join(eb_dir,'puppeteer.config'),yaml.stringify(data, { version:'1.1' }));
    }

    async run() {
        let spawn = require('await-spawn');
        let errors = [];
        //AWS EB deploy
        this.context.debug('AWS EB deploy');
        let eb_full = this.context.x_state.central_config.deploy.replaceAll('eb:','');
        let eb_appname = eb_full;
        let eb_instance = `${eb_appname}-dev`;
        if (eb_full.includes(',')) {
            eb_appname = eb_full.split(',')[0];
            eb_instance = eb_full.split(',').splice(-1)[0];
        }
        if (eb_appname!='') {
            let spinner = this.context.x_console.spinner({ message:'Creating config files' });
            //this.x_console.outT({ message:`Creating EB config yml: ${eb_appname} in ${eb_instance}`, color:'yellow' });
            //create .ebextensions directory
            let path = require('path'), fs = require('fs').promises;
            let eb_base = this.context.x_state.dirs.app;
            let eb_dir_ext = path.join(eb_base,'.ebextensions');
            try { await fs.mkdir(eb_dir_ext, { recursive: true }); } catch(ef) {}
            let eb_dir = path.join(eb_base,'.elasticbeanstalk');
            try { await fs.mkdir(eb_dir, { recursive: true }); } catch(ef) {}
            //write .npmrc file
            await this.context.writeFile(path.join(eb_base,'.npmrc'),'unsafe-perm=true');
            //write .ebextensions/config.yml
            await this._createEBx_configEB();
            //write .ebextensions/01_confignode.config
            await this._createEBx_configNode();
            //write .ebextensions/extend-proxy-timeout.config
            await this._createEBx_timeout();
            //enable websockets?
            if (this.context.x_state.central_config.rtc==true) {
                await this._createEBx_sockets();
            }
            if (this.context.x_state.npm.puppeteer || this.context.x_state.npm['puppeteer-code']) {
                await this._createEBx_puppeteer();
            }
            //create .ebignore file
let eb_ig = `node_modules/
jspm_packages/
.npm
.node_repl_history
*.tgz
.yarn-integrity
.editorconfig
# Mac OSX
.DS_Store
# Elastic Beanstalk Files
.elasticbeanstalk/*
!.elasticbeanstalk/*.cfg.yml
!.elasticbeanstalk/*.global.yml`;
            await this.context.writeFile(path.join(eb_base,'.ebignore'),eb_ig);
            //init git if not already
            spinner.succeed('EB config files created successfully');
            let results = {};
            let git_exists = await this.context.exists(path.join(eb_base,'.git'));
            if (!(git_exists)) {
                //git directory doesn't exist
                //this.context.x_console.outT({ message:'CREATING .GIT DIRECTORY' });
                spinner.start('Initializing project git repository');
                spinner.text('Creating .gitignore file');
let git_ignore=`# Mac System files
.DS_Store
.DS_Store?
__MACOSX/
Thumbs.db
# EB files
node_modules/`;
                
                await this.context.writeFile(path.join(eb_base,'.gitignore'),git_ignore);
                spinner.succeed('.gitignore created');
                spinner.start('Initializing local git repository ..');
                try {
                    results.git_init = await spawn('git',['init','-q'],{ cwd:eb_base });
                    spinner.succeed('GIT initialized');
                } catch(gi) { 
                    results.git_init = gi; 
                    spinner.fail('GIT failed to initialize');
                    errors.push(gi);
                }
                spinner.start('Adding files to local git ..');
                try {
                    results.git_add = await spawn('git',['add','.'],{ cwd:eb_base });
                    spinner.succeed('git added files successfully');
                } catch(gi) { 
                    results.git_add = gi; 
                    spinner.fail('git failed to add local files');
                    errors.push(gi);
                }
                spinner.start('Creating first git commit ..');
                try {
                    results.git_commit = await spawn('git',['commit','-m','Inicial'],{ cwd:eb_base });
                    spinner.succeed('git created first commit successfully');
                } catch(gi) { 
                    results.git_commit = gi; 
                    spinner.fail('git failed to create first commit');
                    errors.push(gi);
                }

            }
            spinner.start('Deploying to AWS ElasticBean .. please wait');
            // execute eb deploy
            try {
                if (this.context.x_config.nodeploy && this.context.x_config.nodeploy==true) {
                    spinner.succeed('EB ready to be deployed (nodeploy as requested)');
                    this.context.x_console.outT({ message:`Aborting final deployment as requested`, color:'brightRed'});
                } else {
                    results.eb_deploy = await spawn('eb',['deploy',eb_instance],{ cwd:eb_base }); //, stdio:'inherit'
                    spinner.succeed('EB deployed successfully');
                }
            } catch(gi) { 
                //test if eb failed because instance has not being created yet, if so create it
                results.eb_deploy = gi; 
                spinner.warn('EB failed to deploy');
                //this.x_console.outT({ message:gi.toString(), color:'red'});
                if (gi.code==4) {
                    // IAM credentials are invalid or instance hasn't being created (eb create is missing)
                    spinner.start('Checking if AWS credentials are valid ..');
                    try {
                        results.eb_create = await spawn('aws',['sts','get-caller-identity'],{ cwd:eb_base }); //, stdio:'inherit'
                        spinner.succeed('AWS credentials are ok');
                    } catch(aws_cred) {
                        spinner.fail('Current AWS credentials are invalid');
                        errors.push(aws_cred);
                    }
                    if (errors.length==0) {
                        spinner.start('This looks like a new deployment: issuing eb create');
                        try {
                            //console.log('eb create\n',['eb','create',eb_instance]);
                            await this.launchTerminal('eb',['create',eb_instance],eb_base);
                            await this.sleep(1000);
                            spinner.succeed('EB created and deployed successfully');
                            //results.eb_create = await spawn('eb',['create',eb_instance],{ cwd:eb_base }); //, stdio:'inherit'
                            //console.log(results.eb_create);
                            //process.exit(6);
                        } catch(ec) {
                            this.context.x_console.outT({ message:gi.stdout.toString(), color:'red'});
                            spinner.fail('EB creation failed');
                            errors.push(gi);
                        }
                    }
                } else {
                    this.context.x_console.outT({ message:'error: eb create (exitcode:'+gi.code+'):'+gi.toString(), color:'red'});
                    errors.push(gi);
                }
            }
            //if errors.length==0 && this.x_state.central_config.debug=='true'
            if (errors.length==0 && this.context.x_state.central_config.debug==true && !this.context.x_config.nodeploy) {
                //open eb logging console
                let ci = require('ci-info');
                if (ci.isCI==false) {
                    spinner.start('Opening EB debug terminal ..');
                    try {
                        let abs_cmd = path.resolve(eb_base);
                        let cmd = `clear; sleep 2; clear; cd ${abs_cmd} && clear && eb open ${eb_instance}`;
                        results.eb_log = await spawn('npx',['terminal-tab',cmd],{ cwd:abs_cmd }); //, detached:true
                        spinner.succeed(`EB logging opened on new tab successfully`);
                    } catch(ot) { 
                        results.eb_log = ot;
                        spinner.fail(`I was unable to open a new tab terminal window with the EB debugging console`);
                    }
                } else {
                    spinner.warn(`Omitting EB debug, because a CI env was detected.`);
                }
            }
            // eb deploy done
        }
        return errors;
    }

    //****************************
    // onPrepare and onEnd steps
    //****************************
    async post() {
        let ci = require('ci-info');
        //restores aws credentials if modified by onPrepare after deployment
        if (!this.context.x_state.central_config.componente && 
            this.context.x_state.central_config.deploy && 
            this.context.x_state.central_config.deploy.indexOf('eb:') != -1 && 
            this.context.x_state.config_node.aws && ci.isCI==false) {
            // @TODO add this block to deploys/eb 'post' method and onPrepare to 'pre' 20-br-21
            // only execute after deploy and if user requested specific aws credentials on map
            let path = require('path'), copy = require('recursive-copy'), os = require('os');
            let aws_bak = path.join(this.context.x_state.dirs.base, 'aws_backup.ini');
            let aws_file = path.join(os.homedir(), '/.aws/') + 'credentials';
            // try to copy aws_bak over aws_ini_file (if bak exists)
            let fs = require('fs');
            let exists = s => new Promise(r=>fs.access(s, fs.constants.F_OK, e => r(!e)));
            if ((await this.context.exists(aws_bak))) {
                await copy(aws_bak,aws_file,{ overwrite:true, dot:true, debug:false });
                // remove aws_bak file
                await fs.promises.unlink(aws_bak);
            }
        }
    }

    async pre() {
        let ci = require('ci-info');
        if (!this.context.x_state.central_config.componente && 
             this.context.x_state.central_config.deploy && 
             this.context.x_state.central_config.deploy.indexOf('eb:') != -1 &&
             ci.isCI==false) {
            // if deploying to AWS eb:x, then recover/backup AWS credentials from local system
            let ini = require('ini'),
                path = require('path'),
                fs = require('fs').promises;
            // read existing AWS credentials if they exist
            let os = require('os');
            let aws_ini = '';
            let aws_folder = path.join(os.homedir(), '/.aws/');
            let aws_ini_file = path.join(aws_folder,'credentials');
            try {
                //this.debug('trying to read AWS credentials:',aws_ini_file);
                aws_ini = await fs.readFile(aws_ini_file, 'utf-8');
                //this.context.debug('AWS credentials:',aws_ini);
            } catch (err_reading) {}
            // 
            if (this.context.x_state.config_node.aws) {
                // if DSL defines temporal AWS credentials for this app .. 
                // create backup of aws credentials, if existing previously
                if (aws_ini != '') {
                    let aws_bak = path.join(this.context.x_state.dirs.base, 'aws_backup.ini');
                    this.context.x_console.outT({ message: `config:aws:creating .aws/credentials backup`, color: 'yellow' });
                    await fs.writeFile(aws_bak, aws_ini, 'utf-8');
                }
                // debug
                this.context.x_console.outT({ message: `config:aws:access ->${this.context.x_state.config_node.aws.access}` });
                this.context.x_console.outT({ message: `config:aws:secret ->${this.context.x_state.config_node.aws.secret}` });
                // transform config_node.aws keys into ini
                let to_ini = ini.stringify({
                    aws_access_key_id: this.context.x_state.config_node.aws.access,
                    aws_secret_access_key: this.context.x_state.config_node.aws.secret
                }, { section: 'default' });
                this.context.debug('Setting .aws/credentials from config node');
                // save as .aws/credentials (ini file)
                try {
                    await fs.writeFile(aws_ini_file, to_ini, 'utf-8');
                } catch(errdir) {
                    //if fails, maybe target dir doesn't exist
                    try {
                        await fs.mkdir(aws_folder, { recursive:true });
                    } catch(errdir2) {
                    }
                }

            } else if (aws_ini != '') {
                // if DSL doesnt define AWS credentials, use the ones defined within the local system.
                let parsed = ini.parse(aws_ini);
                if (parsed.default) this.context.debug('Using local system AWS credentials', parsed.default);
                this.context.x_state.config_node.aws = { access: '', secret: '' };
                if (parsed.default.aws_access_key_id) this.context.x_state.config_node.aws.access = parsed.default.aws_access_key_id;
                if (parsed.default.aws_secret_access_key) this.context.x_state.config_node.aws.secret = parsed.default.aws_secret_access_key;
            }
        }
    }

    // config hooks
    async setEnvs(envs) {
        return [...envs,'START_TYPE=production'];
    }

    async codeForModel(model) {
        //express = {models,routes}
        //returns array with records of lines of code
        let resp = [];
        //aws config requirements
        if (this.context.x_state.npm['aws-sdk']) {
            if (!this.context.x_state.config_node.aws) {
                this.context.x_state.npm['aws-get-credentials'] = '*';
                resp.push(`const AWS = require('aws-sdk');
                (async function() {
                    const { getAWSCredentials } = require('aws-get-credentials');
                    AWS.config.credentials = await getAWSCredentials();;
                })();
                const AWS_s3 = new AWS.S3();`);
            } else {
                let aws_data = {
                    accessKeyId: this.context.x_state.config_node.aws.access,
                    secretAccessKey: this.context.x_state.config_node.aws.secret
                };
                if (this.context.x_state.config_node.aws.region) {
                    aws_data.region = this.context.x_state.config_node.aws.region;
                }
                resp.push(`const AWS = require('aws-sdk');
                AWS.config.update(${this.context.jsDump(aws_data)});
                const AWS_s3 = new AWS.S3();`);
            }
        }
        return resp;
    }

}