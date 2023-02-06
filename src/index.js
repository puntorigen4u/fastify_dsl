const concepto = require('@concepto/interface');
//import { timingSafeEqual } from 'crypto';
//import { isContext, runInThisContext } from 'vm';
//import concepto from '../../concepto/src/index'
/**
 * Concepto FASTIFY DSL Class: A class for compiling fastify.dsl Concepto diagrams into NodeJS Fastify backend services.
 * @name 	fastify_dsl
 * @module 	fastify_dsl
 **/
//import internal_commands from './commands'
import deploy_local from './deploys/local'
import deploy_eb from './deploys/eb'
import dedent from 'dedent'

export default class fastify_dsl extends concepto {

    constructor(file, config = {}) {
        // we can get class name, from package.json name key (after its in its own project)
        let my_config = {
            class: 'fastify',
            debug: true
        };
        let nuevo_config = {...my_config, ...config };
        super(file, nuevo_config); //,...my_config
        // custom dsl_git version
        this.x_config.dsl_git = async function(content) {
            //save git version
            let tmp = {}, fs = require('fs').promises, path = require('path');
            //SECRETS
            this.x_state.config_node = await this._readConfig(false);
            if (this.x_flags.dsl.includes('_git.dsl')) {
                // if file is x_git.dsl, expand secrets
                this.x_console.outT({ message:'we are the git!', color:'green' });
                this.x_state.config_node = await this._restoreSecrets(this.x_state.config_node);
                delete this.x_state.config_node[':id'];
                delete this.x_state.config_node[':secrets'];
                delete this.x_state.config_node['::secrets'];
                //search and erase config->:secrets node
                //this.x_console.out({ message:'config read on git',data:this.x_state.config_node });
            } else {
                // if file is x.dsl,
                // write x_git.dsl
                tmp.dsl_path = path.dirname(path.resolve(this.x_flags.dsl));
                tmp.dsl_git = path.join(tmp.dsl_path,path.basename(this.x_flags.dsl).replace('.dsl','_git.dsl'));
                await fs.writeFile(tmp.dsl_git,content,'utf-8');
                this.debug(`custom dsl_git file saved as: ${tmp.dsl_git}`);
                // export secret keys as :secrets node to eb_git.dsl
                await this._secretsToGIT(this.x_state.config_node);
            }
            //
        }.bind(this);
    }

    // SECRETS helpers
    async _secretsToGIT(resp) {
        let path = require('path'), fs = require('fs').promises;
        let encrypt = require('encrypt-with-password');
        let curr_dsl = path.basename(this.x_flags.dsl);
        // secret nodes to _git.dsl file
        if (resp['::secrets'] && resp['::secrets'].length>0 && !curr_dsl.includes('_git.')) {
            //encrypt existing secret (password) nodes and save them as config->:secrets within _git.dsl file version
            let password = '';
            if (this.x_config.secrets_pass && this.x_config.secrets_pass!='') password = this.x_config.secrets_pass.trim();
            if (password=='') {
                //if a password was not given, invent a memorable one
                let gpass = require('password-generator');
                password = gpass();
                resp[':password'] = password; //inform a pass was created
            }
            //encrypt secrets object
            let to_secrets = encrypt.encryptJSON(resp['::secrets'],password);
            //create :secrets node within eb_git.dsl file
            let dsl_parser = require('@concepto/dsl_parser');
			let dsl = new dsl_parser({ file:this.x_flags.dsl.replace('.dsl','_git.dsl'), config:{ cancelled:true, debug:false } });
			try {
				await dsl.process();
			} catch(d_err) {
				this.x_console.out({ message:`error: file ${this.x_flags.dsl.replace('.dsl','_git.dsl')} does't exist!`,data:d_err });
				return;
			}
            let new_content = await dsl.addNode({ parent_id:resp[':id'], node:{
                text:':secrets',
                icons: ['password'],
                text_note: to_secrets
            }});
            let tmp={};
            tmp.dsl_git_path = path.dirname(path.resolve(this.x_flags.dsl));
            let git_target = path.join(tmp.dsl_git_path,path.basename(this.x_flags.dsl).replace('.dsl','_git.dsl')); //,path.basename(this.x_flags.dsl)
            await fs.writeFile(git_target,new_content,'utf-8');
            this.debug(`dsl_git file saved as: ${git_target}`);
            if (resp[':password']) {
                this.x_console.outT({ message:`Password generated for DSL GIT secrets ->${password}`, color:'brightGreen' });
            }
            //
        }
        return resp;
    }
    // restore :secrets node info if it exists and a password was given
    async _restoreSecrets(resp) {
        let path = require('path'), fs = require('fs').promises;
        let encrypt = require('encrypt-with-password');
        let curr_dsl = path.basename(this.x_flags.dsl);
        if (curr_dsl.includes('_git.') && resp[':secrets']) {
            this.x_console.outT({ message:`Secrets node detected!`, color:'brightCyan' });
            if (this.x_config.secrets_pass && this.x_config.secrets_pass!='') {
                this.x_console.outT({ message:'Decrypting config->secrets', color:'brightGreen' });
                try {
                    let from_secrets = encrypt.decryptJSON(resp[':secrets'],this.x_config.secrets_pass);
                    // read nodes into resp struct
                    for (let xs of from_secrets) {
                        resp = {...resp,...this.configFromNode(resp,xs)};
                    }
                    let tmp = {};
                    tmp.dsl_git_path = path.dirname(path.resolve(this.x_flags.dsl));
                    tmp.non_target = path.join(tmp.dsl_git_path,path.basename(this.x_flags.dsl).replace('_git.dsl','.dsl'));
                    tmp.exists_non = await this.exists(tmp.non_target);
                    if (true) { //!tmp.exists_non - always overwrite x.dsl
                        this.x_console.outT({ message:'Expanding secrets into '+curr_dsl.replace('_git.dsl','.dsl'), color:'cyan' });
                        // expand secret nodes into non _git.dsl version config key
                        let dsl_parser = require('@concepto/dsl_parser');
                        let dsl = new dsl_parser({ file:this.x_flags.dsl, config:{ cancelled:true, debug:false } });
                        try {
                            await dsl.process();
                        } catch(d_err) {
                            this.x_console.out({ message:`error: file ${this.x_flags.dsl} does't exist!`,data:d_err });
                            return;
                        }
                        // remove config->:secrets node if it exists
                        let $ = dsl.getParser();
                        let search = $(`node[TEXT=config] node[TEXT=\:secrets]`).toArray();
                        search.map(function(elem) {
                            $(elem).remove();
                        });
                        //
                        let new_content = '';
                        for (let sn of from_secrets) {
                            new_content = await dsl.addNode({ parent_id:resp[':id'], node:sn });
                        }
                        // save expanded x.dsl file (only if it doesnt exist)
                        await fs.writeFile(tmp.non_target,new_content,'utf-8');
                        this.debug(`recovered dsl file saved as: ${tmp.non_target}`);
                    }
                    //

                } catch(invpass) {
                    //console.log(invpass);
                    this.x_console.outT({ message:'Invalid --secret-pass value for map (check your password)', color:'brightRed' });
                    this.x_console.outT({ message:'WARNING: The process may fail if keys are needed', color:'red' });
                }
            } else {
                this.x_console.outT({ message:'WARNING: file contains secrets, but no --secrets-pass arg was given', color:'brightRed' });
                this.x_console.outT({ message:'WARNING: The process may fail if keys are needed', color:'red' });
            }
        }
        return resp;
    }
    //

    // **************************
    // methods to be auto-called
    // **************************

    //Called after init method finishes
    async onInit() {
        if (Object.keys(this.x_commands).length>0) this.x_console.outT({ message: `${Object.keys(this.x_commands).length} local x_commands loaded!`, color: `green` });
        // init
        // set x_state defaults
        this.x_state = {...this.x_state,...{
            plugins: {},
            npm: {},
            dev_npm: {},
            envs: {},
            functions: {},
            proxies: {},
            pages: {},
            current_func: '',
            current_folder: '',
            current_proxy: '',
            strings_i18n: {},
            stores: {},
            stores_types: { versions: {}, expires: {} },
            nuxt_config: { head_script: {}, build_modules: {}, modules: {} },
        }};
        let ci = require('ci-info');
        this.isCI = ci.isCI;
        if (!this.x_state.config_node) this.x_state.config_node = await this._readConfig();
        //this.debug('config_node',this.x_state.config_node);
        this.x_state.central_config = await this._readCentralConfig();
        //if requested silence...
        if (this.x_config.silent) {
            this.x_console.outT({ message: `silent mode requested`, color: `dim` });
            //this.x_console.setSilent(true);
            this.x_config.debug=false;
        }
        //this.debug('central_config',this.x_state.central_config);
        //this.x_state.assets = await this._readAssets();
        //this.debug('assets_node',this.x_state.assets);
        if (this.x_config.deploy && this.x_config.deploy.trim()!='') {
            this.x_console.outT({ message: `(as requested) force changing deploy target to: ${this.x_config.deploy.trim()}`, color: `brightYellow` });
            this.x_state.central_config.deploy = this.x_config.deploy;
        }
        let _folders = {
			'bin': 'bin/',
			'models': 'models/',
			'routes': 'routes/',
			'views': 'views/',
            'db_models': 'prisma/',
			'public': 'public/',
			'doc': 'doc/'
		};
        if (this.x_state.central_config.deploy && this.x_state.central_config.deploy.includes('sls:')) {
            _folders.secrets = 'secrets/';
        }
		this.x_state.dirs = await this._appFolders(_folders);
        // read modelos node (Prisma DB)
        this.x_state.models = await this._readModelos(); //alias: database tables
        console.log('PABLO debug models',this.x_state.models);
        //is local server running? if so, don't re-launch it
        this.x_state.fastify_is_running = await this._isLocalServerRunning();
        this.debug('is Server Running: ' + this.x_state.fastify_is_running);
        // init terminal diagnostics
        if (this.atLeastNode('10') == false) {
            //this.debug('error: You need at least Node v10+ to use latest version!');
            throw new Error('You need to have at least Node v10+ to run these instances!');
        }
        this.x_state.es6 = true;
        // copy sub-directories if defined in node 'config.copiar' key
        if (this.x_state.config_node.copiar) {
            let path = require('path');
            let copy = require('recursive-copy');
            this.x_console.outT({ message: `copying config:copiar directories to 'root' target folder`, color: `yellow` });
            await Object.keys(this.x_state.config_node.copiar).map(async function(key) {
                let abs = path.join(this.x_state.dirs.base, key);
                try {
                    await copy(abs, path.join(this.x_state.dirs.app,key));
                } catch (err_copy) {
                    if (err_copy.code != 'EEXIST') this.x_console.outT({ message: `error: copying directory ${abs}`, data: err_copy });
                }
                //console.log('copying ',{ from:abs, to:this.x_state.dirs.static });
            }.bind(this));
            this.x_console.outT({ message: `copying config:copiar directories ... READY`, color: `yellow` });
        }
        // *********************************************
        // install requested modules within config node
        // *********************************************
        this.x_console.outT({ message: `fastify initialized() ->` });
        // JSDoc
        this.x_state.dev_npm['jsdoc'] = '*';
        this.x_state.dev_npm['jsdoc-i18n-plugin'] = '*';
        this.x_state.dev_npm['@pixi/jsdoc-template'] = '*';
        // add fastify support
        this.x_state.npm['@fastify/autoload']='^5.0.0';
        this.x_state.npm['@fastify/sensible']='^5.0.0';
        this.x_state.npm['@fastify/static']='6.6.1';
        this.x_state.npm['@fastify/view']='^7.4.0';
        this.x_state.npm['fastify']='^4.0.0';
        this.x_state.npm['fastify-cli']='^5.7.1';
        this.x_state.npm['fastify-plugin']='^4.0.0';
        this.x_state.dev_npm['fastify-prisma-client']='^5.0.0';
        this.x_state.dev_npm['prisma']='^4.8.1';
        this.x_state.dev_npm['tap']='^16.1.0';
        // undescore & other lib support
        this.x_state.dev_npm['lodash']='^4.17.11';
        this.x_state.npm['underscore']='*';
        this.x_state.npm['axios']='*';
        this.x_state.npm['file-type']='*';
        this.x_state.npm['moment']='*';
        this.x_state.npm['moment-timezone']='*';
        // additional required dependencies
        /*
        this.x_state.npm['colors']='*';
        this.x_state.npm['country-tz']='^1.0.0';
        this.x_state.npm['async']='*';
        this.x_state.npm['aws-sdk']='*';
        this.x_state.npm['countryinfo']='^1.0.2';
        this.x_state.npm['debug']='*';
        this.x_state.npm['body-parser']='*';
        this.x_state.npm['cookie-parser']='*';
        this.x_state.npm['ejs']='*';
        this.x_state.npm['extract-string']='*';*/
        // express protection and related libraries
        /*this.x_state.npm['helmet']='*';
        this.x_state.npm['cors']='*';
        this.x_state.npm['http']='*';
        this.x_state.npm['http-proxy']='*';
        this.x_state.npm['compression']='*';
        */
        // other libraries
        /*
        this.x_state.npm['morgan']='*'; // log related
        this.x_state.npm['multer']='*'; // file upload support
        this.x_state.npm['mysql2']='*'; // sql support
        this.x_state.npm['sequelize']='*'; // db
        this.x_state.npm['node-geocoder']='*';
        this.x_state.npm['node-pushnotifications']='*';
        this.x_state.npm['node-schedule']='*';
        this.x_state.npm['nodemon']='*';
        this.x_state.npm['postman-request']='*';
        this.x_state.npm['request']='*';
        */
        //this.x_state.npm['wait.for']='*';
        //this.x_state.npm['serve-favicon']='*'; // favicon support

        // FAVICON
        if (this.x_state.config_node.favicon) {
            // copy icon to static dir
            let path = require('path');
            let source = path.join(this.x_state.dirs.base, this.x_state.config_node.favicon);
            let target = this.x_state.dirs.app + 'icon.png';
            this.debug({ message: `ICON dump (copy icon)`, color: `yellow`, data: source });
            let fs = require('fs').promises;
            try {
                await fs.copyFile(source, target);
            } catch (err_fs) {
                this.x_console.outT({ message: `error: copying fastify icon`, data: err_fs });
            }
        }
        // serialize 'secret' config keys as json files in app secrets sub-directory (if any)
        // extract 'secret's from config keys; 
        /* */
        this.debug('serializing secrets');
        this.x_state.secrets={}; //await _extractSecrets(config_node)
        let path = require('path');
        for (let key in this.x_state.config_node) {
            if (typeof key === 'string' && key.includes(':')==false) {
                if (this.x_state.config_node[key][':secret']) {
                    let new_obj = {...this.x_state.config_node[key]};
                    delete new_obj[':secret']
                    if (new_obj[':link']) delete new_obj[':link']
                    // set object keys to uppercase
                    this.x_state.secrets[key]={};
                    let obj_keys = Object.keys(new_obj);
                    for (let x in obj_keys) {
                        this.x_state.secrets[key][x.toUpperCase()] = new_obj[x];
                    }
                    if (this.x_state.dirs.secrets) {
                        let target = path.join(this.x_state.dirs.secrets, `${key}.json`);
                        await this.writeFile(target,JSON.stringify(new_obj));
                    }
                }
            }
        }
        this.debug('setting ENV variables');
        // set config keys as ENV accesible variables (ex. $config.childnode.attributename)
        for (let key in this.x_state.config_node) {
            // omit special config 'reserved' (aurora,vpc,aws) node keys
            if (!['vpc', 'aws','copiar'].includes(key) && typeof this.x_state.config_node[key] === 'object') {
                Object.keys(this.x_state.config_node[key]).map(function(attr) {
                    this.x_state.envs[`config.${key}.${attr}`] = `process.env.${(key+'_'+attr).toUpperCase()}`;
                }.bind(this));
            }
        }
        
        // show this.x_state contents
        //this.debug('x_state says',this.x_state);
    }

    //Called after parsing nodes
    async onAfterProcess(processedNode) {
        return processedNode;
    }

    //Called for defining the title of class/page by testing node.
    async onDefineTitle(node) {
        let resp = node.text;
        Object.keys(node.attributes).map(function(i) {
            if (i == 'title' || i == 'titulo') {
                resp = node.attributes[i];
                return false;
            }
        }.bind(this));
        /*
        for (i in node.attributes) {
        	if (['title','titulo'].includes(node.attributes[i])) {
        		resp = node.attributes[i];
        		break;
        	}
        }*/
        return resp;
    }

    //Called for naming filename of class/page by testing node.
    async onDefineFilename(node) {
        return node.text;
    }

    //Called for naming the class/page by testing node.
    async onDefineNodeName(node) {
        return node.text.replace(' ', '_');
    }

    //Defines template for code given the processedNode of process() - for each level2 node
    async onCompleteCodeTemplate(processedNode) {
        return processedNode;
    }

    //Defines preparation steps before processing nodes.
    async onPrepare() {
        if (Object.keys(this.x_commands).length>0) this.x_console.outT({ message: `${Object.keys(this.x_commands).length} x_commands loaded!`, color: `green` });
        this.deploy_module = { pre:()=>{}, post:()=>{}, deploy:()=>true };
        let deploy = this.x_state.central_config.deploy;
        if (deploy) {
            deploy += '';
            if (deploy.includes('eb:')) {
                this.deploy_module = new deploy_eb({ context:this });
            } else if (deploy=='local') {
                this.deploy_module = new deploy_local({ context:this }); 
                //
            } else if (deploy=='localsls') {
                //sls local deployment

            } else if (deploy==true) {
                //sls deploy; use central_config domain for deployment
            }
        }
        await this.deploy_module.pre();
    }

    //Executed when compiler founds an error processing nodes.
    async onErrors(errors) {
        this.errors_found=true;
    }

    //.gitignore helper
    async createGitIgnore() {
        this.debug('writing .gitignore files');
        let fs = require('fs').promises;
        this.debug({ message: 'writing dsl /.gitignore file' });
        let git =
`# Mac System files
.DS_Store
.DS_Store?
_MACOSX/
Thumbs.db
# Logs
logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage

# nyc test coverage
.nyc_output

# Grunt intermediate storage (http://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# node-waf configuration
.lock-wscript

# Compiled binary addons (http://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules
jspm_packages

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# 0x
profile-*

# mac files
.DS_Store

# vim swap files
*.swp

# webstorm
.idea

# vscode
.vscode
*code-workspace

# clinic
profile*
*clinic*
*flamegraph*
${this.x_state.dirs.compile_folder}/`;
            await fs.writeFile(`${this.x_state.dirs.base}.gitignore`, git, 'utf-8'); //.gitignore
    }

    // create /README.md file
    async createReadme() {
        let fs = require('fs').promises;
        if (this.x_state.central_config.readme!='') {        
            let set_envs = [];
            for (let key in this.x_state.config_node) {
                if (!['vpc', 'aws','copiar'].includes(key) && typeof this.x_state.config_node[key] === 'object') {
                    Object.keys(this.x_state.config_node[key]).map(function(attr) {
                        if (key.charAt(0)!=':' && attr.charAt(0)!=':') {
                            set_envs.push(`${key.toUpperCase()}_${attr.toUpperCase()}`);
                        }
                    }.bind(this));
                }
            }
            let content = `<b>${this.x_state.central_config.readme}</b><br/><br/>
            APP_PORT (int)<br/>
            CLUSTER (int)<br/>`;
            if (set_envs.length>0) {
                content += `Esta aplicacion requiere configurar las siguientes variables de entorno en la instancia de ElasticBean:<br/><br/>`;
                content += set_envs.join('<br/>')+'\n';
            }
            await fs.writeFile(`${this.x_state.dirs.app}README.md`, content, 'utf-8');
        }
    }

    async createErrorTemplate() {
        let fs = require('fs').promises;
        let content = `<h1><%= message %></h1>
        <h2><%= error.status %></h2>
        <pre><%= error.stack %></pre>`;
        await fs.writeFile(`${this.x_state.dirs.views}error.ejs`, content, 'utf-8');
    }

    async createJSDoc() {
        // jsdoc.js file
        let data = {
            plugins: ['./node_modules/jsdoc-i18n-plugin/'],
            i18n: {
                locale: 'en_ES',
                directory: './doc/en_ES/',
                srcDir: './doc/en_US/',
                extension: '.js'
            },
            tags: {
                allowUnknownTags: true
            },
            opts: {
                encoding: 'utf8',
                destination: './public/doc',
                recurse: true,
                template: './node_modules/@pixi/jsdoc-template'
            },
            templates: {
                default: {
                    outputSourceFiles: false
                }
            }
        };
        let content = JSON.stringify(data);
        await this.writeFile(`${this.x_state.dirs.app}jsdoc.json`,content);
    }

    //server launcher file (ex with cluster support etc)
    async createBinFile() {
        let content = `#!/usr/bin/env node
const app = require('../app');
const port = normalizePort(process.env.PORT || '8081');
const os = require('os');
const cluster = require('cluster');
const clusterWorkerSize = os.cpus().length;
const fastifyOptions = {
    logger: false,
    disableRequestLogging: true
};

// methods
const normalizePort = (val) => {
	var port = parseInt(val, 10);
	if (isNaN(port)) {
		return val;
	}
	if (port >= 0) {
		return port;
	}
	return false;
}

// Run the server with cluster support
if (clusterWorkerSize > 1) {
    if (cluster.isMaster) {
        for (let i = 0; i < clusterWorkerSize; i += 1) {
            cluster.fork();
        }
        cluster.on('exit', (worker)=>{
            console.log(\`Worker \${worker.id} has exited\`);
        })
    } else {
        app.start(port,fastifyOptions);
    }
} else {
    app.start(port,fastifyOptions);
}
`;
        await this.writeFile(`${this.x_state.dirs.bin}www`,content);
    }

    async createPackageJSON() {
        let cleanLinesDoc = function(text) {
            //trim each line
            let resp = '', lines = text.split('\n'), used=0;
            for (let line in lines) {
                let t_line = lines[line].trim();
                if (t_line!='') {
                    //if (used!=0) resp += ' * ';
                    resp += t_line + '\n';
                    used+=1;
                }
            }
            if (resp.slice(-1)=='\n') resp = resp.substr(0,resp.length-1);
            //resp += ' * ';
            return resp;
        };
        let data = {
            name: this.x_state.central_config.service_name.toLowerCase(),
            description: cleanLinesDoc(this.x_state.central_config[':description']),
            main: 'app.js',
            scripts: {
                start: './app',
                dev: 'nodemon ./app.js',
                build: 'npm run _doc',
                _doc: 'jsdoc ./routes -c ./jsdoc.json -R ./README.md'
            },
            dependencies: {},
            devDependencies: {},
            keywords: []
        };
        if (this.x_state.central_config[':version']!='auto') data.version = this.x_state.central_config[':version'];
        if (this.x_state.central_config[':author']) data.author = this.x_state.central_config[':author'];
        if (this.x_state.central_config[':license']) data.license = this.x_state.central_config[':license'];
        if (this.x_state.central_config[':git']) {
            data.repository = {
                type: 'git',
                url: `git+${this.x_state.central_config[':git']}.git`
            };
            data.bugs = {
                url: `${this.x_state.central_config[':git']}/issues`
            }
            data.homepage = this.x_state.central_config[':git'];
        }
        if (this.x_state.central_config[':keywords']) data.keywords = this.x_state.central_config[':keywords'].split(',');
        // set port and env variables to script dev
        let set_envs = [`APP_PORT=${this.x_state.central_config.port}`,`CLUSTER=1`];
        for (let key in this.x_state.config_node) {
            if (!['vpc', 'aws','copiar'].includes(key) && typeof this.x_state.config_node[key] === 'object') {
                Object.keys(this.x_state.config_node[key]).map(function(attr) {
                    if (key.charAt(0)!=':' && attr.charAt(0)!=':') {
                        set_envs.push(`${key.toUpperCase()}_${attr.toUpperCase()}=${this.x_state.config_node[key][attr]}`);
                    }
                }.bind(this));
            }
        }
        // omit stage as start_type; it seems its not needed
        // call hook for deploy_module (if needs to add env variables depending on deploy)
        if (this.deploy_module.setEnvs) {
            set_envs = await this.deploy_module.setEnvs(set_envs);
        }
        // add to package script _dev
        data.scripts.dev = set_envs.join(' ') + ' ' + data.scripts.dev;
        //
        //add dependencies
        for (let pack in this.x_state.npm) {
            if (this.x_state.npm[pack].includes('http') && this.x_state.npm[pack].includes('github.com')) {
                data.dependencies[pack] = `git+${this.x_state.npm[pack]}`;
            } else {
                data.dependencies[pack] = this.x_state.npm[pack];
            }
        }
        //add devDependencies
        for (let pack in this.x_state.dev_npm) {
            if (this.x_state.dev_npm[pack].includes('http') && this.x_state.dev_npm[pack].includes('github.com')) {
                data.devDependencies[pack] = `git+${this.x_state.dev_npm[pack]}`;
            } else {
                data.devDependencies[pack] = this.x_state.dev_npm[pack];
            }
        }
        //write to disk
        let path = require('path');
        let target = path.join(this.x_state.dirs.app,`package.json`);
        let content = JSON.stringify(data);
        await this.writeFile(target,content);
        //this.x_console.outT({ message:'future package.json', data:data});
    }

    async createVSCodeHelpers() {
        // creates Visual Studio code common helpers
        let path = require('path');
        // creates /jsconfig.json file for IntelliSense
        let data = {
            include: [ './client/**/*' ],
            compilerOptions: {
                module: 'es2015',
                moduleResolution: 'node',
                target: 'es5',
                sourceMap: true,
                paths: {
                    '~/*': ['./client/*'],
                    '@/*': ['./client/*'],
                    '~~/*': ['./*'],
                    '@@/*': ['./*'] 
                }
            },
            exclude: ['node_modules','secrets']
        };
        //write to disk
        let target = path.join(this.x_state.dirs.app,`jsconfig.json`);
        let content = JSON.stringify(data);
        await this.writeFile(target,content);
    }

    async createServerlessYML() {
        let yaml = require('yaml'), data = {};
        let deploy = this.x_state.central_config.deploy+'';
        if (deploy.includes('eb:')==false &&
            deploy!=false &&
            deploy!='local') {
            data.service = this.x_state.central_config.service_name;
            data.custom = {
                prune: {
                    automatic: true,
                    includeLayers: true,
                    number: 1
                },
                apigwBinary: {
                    types: ['*/*']
                }
            };
            //add 'secrets' config json keys - cfc:12895
            //this.x_state.secrets
            for (let secret in this.x_state.secrets) {
                data.custom[secret] = '${file(secrets/'+secret+'.json)}'
            }
            //domain info
            if (this.x_state.central_config.dominio) {
                data.custom.customDomain = {
                    domainName: this.x_state.central_config.dominio
                };
                if (this.x_state.central_config.basepath) data.custom.customDomain.basePath = this.x_state.central_config.basepath;
                if (this.x_state.central_config.stage) data.custom.customDomain.stage = this.x_state.central_config.stage;
                data.custom.customDomain.createRoute53Record = true;
            }
            //nodejs env on aws
            data.provider = {
                name: 'aws',
                runtime: 'nodejs8.10',
                timeout: this.x_state.central_config.timeout
            };
            if (this.x_state.central_config.stage) data.provider.stage = this.x_state.central_config.stage;
            //env keys
            if (Object.keys(this.x_state.config_node)!='') {
                data.provider.enviroment = {};
                if (this.x_state.central_config.stage) data.provider.enviroment.STAGE = this.x_state.central_config.stage;
                if (this.x_state.config_node.vpc) {
                    data.provider.vpc = {
                        securityGroupIds: [this.x_state.config_node.vpc.security_group_id],
                        subnetIDs: []
                    };
                    if (this.x_state.secrets.vpc) {
                        data.provider.vpc.securityGroupIds = ['${self:custom.vpc.SECURITY_GROUP_ID}'];
                    }
                    if (this.x_state.config_node.vpc.subnet1_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET1_ID}'); 
                    if (this.x_state.config_node.vpc.subnet2_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET2_ID}');
                    if (this.x_state.config_node.vpc.subnet3_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET3_ID}');
                    if (this.x_state.config_node.vpc.subnet4_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET4_ID}');
                    if (this.x_state.config_node.vpc.subnet5_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET5_ID}');
                    if (this.x_state.config_node.vpc.subnet6_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET6_ID}');
                    if (this.x_state.config_node.vpc.subnet7_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET7_ID}');
                }
            }
            //aws iam for s3 permissions (x_state.aws_iam) (@TODO later - cfc:12990)
            /*
            data.provider.iamRoleStatements = {
                Effect: 'Allow'
            };*/
            //nuxt handler
            data.functions = {
                nuxt: {
                    handler: 'index.nuxt',
                    events: [{'http':'ANY /'},{'http':'ANY /{proxy+}'}]
                }
            };
            if (this.x_state.central_config['keep-warm']) {
                data.functions.nuxt.events.push({ schedule: 'rate(20 minutes)'})
            }
            //aws resources for s3 (x_state.aws_resources) (@TODO later - no commands use them - cfc:13017)
            //serverless plugins
            data.plugins = ['serverless-apigw-binary',
                            'serverless-offline',
                            'serverless-prune-plugin'];
            if (this.x_state.central_config.dominio) data.plugins.push('serverless-domain-manager');
            //write yaml to disk
            let content = yaml.stringify(data);
            let path = require('path');
            let target = path.join(this.x_state.dirs.app,`serverless.yml`);
            await this.writeFile(target,content);
            //debug
            //this.debug('future serverless.yml', content);
        }
    }

    async getExpressModels() {
        let sort = function(obj) {
            return Object.entries(obj).sort((a,b)=>a[0].length-b[0].length).map(el=>el[0]);
        };
        let express_models = {}; // grouped functions by main path folder
        let routes = { raw:{}, ordered:[] };
        for (let key in this.x_state.functions) {
            let file = key.split('_')[0];
            if (!express_models[file]) {
                express_models[file] = {
                    functions:{},
                    ordered_functions:[],
                    imports:{},
                    route:file,
                    model:file,
                    path:`/${file}/`,
                };
            }
            if (!express_models[file].functions[key]) {
                express_models[file].functions[key]=this.x_state.functions[key];
            }
            express_models[file].ordered_functions = sort(express_models[file].functions);
            // merge function's imports into dad (e_model) imports
            for (let import_name in this.x_state.functions[key].imports) {
                express_models[file].imports[import_name] = import_name;
            }
            // add pathlen key for later struct sort
            if (typeof this.x_state.functions[key].path == 'string') {
                express_models[file].functions[key].pathlen = this.x_state.functions[key].path.length;
            } else {
                // this can happen when cache had a path that now is cancelled
            }
            if (express_models[file].functions[key].visible==true) {
                routes.raw[`/${file}/`] = file;
            }
        }
        routes.ordered = sort(routes.raw);
        let resp = { models:express_models, routes };
        return resp;
    }

    async writeTemplate(template, target, context) {
        const path = require('path'), fs = require('fs').promises;
        const handlebars = require('handlebars');
        const app_template = path.join(__dirname,template+'.hbs');
        const app_template_ = await fs.readFile(app_template, 'utf8');
        const appTemplate = handlebars.compile(app_template_);
        let content = appTemplate(context);
        let appjs = path.join(this.x_state.dirs.app,target);
        await this.writeFile(appjs,content);
    }

    async createAppJS(express) {
        //const path = require('path'), fs = require('fs').promises;
        //const handlebars = require('handlebars');
        // create app_routes code
        let app_routes = [];
        for (let route_x in express.routes.ordered) {
            let route = express.routes.ordered[route_x];
            app_routes.push(`app.use('${route}', require('./routes/${express.routes.raw[route]}'));`);
        }
        // content
        //let app_template = path.join(__dirname,'templates','app.hbs');
        //const app_template_ = await fs.readFile(app_template, 'utf8');
        //const appTemplate = handlebars.compile(app_template_);
        const app_context = {
            imports: [],
            plugins: [],
            code: ''
        };
        app_context.code = '';
        
        // create cors origin options
        let cors_options = {};
        if (this.x_state.config_node.cors) {
            cors_options.origin = [];
            for (let x in this.x_state.config_node.cors) {
                cors_options.origin.push(this.x_state.config_node.cors[x]);
            }
        }
        //set cors, cluster, port, etc

        //post-processing
        await writeTemplate('app','app.js',app_context);
        //let content = appTemplate(app_context);
        //write file
        //let appjs = path.join(this.x_state.dirs.app,'app.js');
        //await this.writeFile(appjs,content);
    }

    async createIndex(express) {
        let path = require('path');
        // get path routes
        let app_routes = [];
        for (let route_x in express.routes.ordered) {
            let route = express.routes.ordered[route_x];
            if (route.charAt(0)=='/') route = route.right(route.length-1);
            let no_slash = route.replaceAll('/','');
            app_routes.push(`case '${no_slash}':
                                res.redirect('/');
                                break;
                             case '${route}':
                                res.redirect('/');
                                break;
                            `);
        }
        // create content
        let content = `var express = require('express');
        var router = express.Router();
        var path = require('path');

        var apicache = require('apicache');
        var cache = apicache.middleware;

        // rutas por defecto para documentacion
        router.get(['/*'], function(req, res, next) {
            switch (req.url) {
                case "/":
                    res.send('OK');
                break;
                ${app_routes.join('\n')}
                default:
                    res.redirect('/');
                break;
            }
        });
        module.exports = router;\n`;
        // write file
        let target = path.join(this.x_state.dirs.routes,'index.js');
        await this.writeFile(target,content);
    }

    async createRoutes(express) {
        let listDeleteAt = function(list, position, delimiter) {
            delimiter = (delimiter === undefined) ? "," : delimiter;
            var arr = list.split(delimiter);
            if (position >= 1 && position <= arr.length) {
                arr.splice(position - 1, 1);
                return arr.join(delimiter);
            }
            return list;
        };
        let cleanLinesDoc = function(text) {
            //trim each line
            let resp = '', lines = text.split('\n'), used=0;
            for (let line in lines) {
                let t_line = lines[line].trim();
                if (t_line!='') {
                    if (used!=0) resp += ' * ';
                    resp += t_line + '\n';
                    used+=1;
                }
            }
            resp += ' * ';
            return resp;
        };
        let ccase = require('fast-case'), path = require('path');
        // create routes files from express models
        for (let file in express.models) {
            // get unique sub-routes
            let unique = {};
            for (let func of express.models[file].ordered_functions) {
                if (express.models[file].functions[func] && express.models[file].functions[func].path) {                
                    let path = express.models[file].functions[func].path.trim().split('/');
                    path.pop(); //remove last item
                    path = path.join('/');
                    if (!unique[path] && path.includes('/')==true && path!='/'+file) {
                        unique[path] = path.replaceAll('/','_');
                        if (unique[path].charAt(0)=='_') unique[path]=unique[path].substr(1,unique[path].length-1);
                    }
                } else {
                    //this can be true if cache had a path that is now cancelled
                }
            }
            // code
            let content = `/**
 * Servicios en ruta /${file}
 * @namespace {object} ${file}
 */
var express = require('express');
var router = express.Router();

var apicache = require('apicache');
var cache = apicache.middleware;

var ${file} = require('../models/${file}');
            `;
            if (Object.keys(unique).length>0) content += `// declaracion de sub-rutas en esta ubicacion\n`;
            for (let route in unique) {
                content += `/**
 * Servicios en ruta ${route}
 * @namespace {object} ${unique[route]}
 */\n`;
            }
            // write each function signature
            for (let func of express.models[file].ordered_functions) {
                if (express.models[file].functions[func] && express.models[file].functions[func].path) {
                    // write jsdoc info for function
                    let _jsdoc = {
                        method: express.models[file].functions[func].method.toLowerCase(),
                        path_o: express.models[file].functions[func].path.trim(),
                        doc: cleanLinesDoc(express.models[file].functions[func].doc)
                    };
                    if (_jsdoc.path_o.charAt(0)=='/') _jsdoc.path_o = _jsdoc.path_o.substr(1,_jsdoc.path_o.length-1); 
                    if (_jsdoc.doc=='') _jsdoc.doc = 'Funcion no documentada';
                    //console.log('PABLO debug without first0:',_jsdoc.path_o);
                    let without_first = listDeleteAt(_jsdoc.path_o,1,'/');
                    //console.log('PABLO debug without first1:',without_first);
                    _jsdoc.path = `/${without_first}`;
                    _jsdoc.method_name = _jsdoc.path_o.split('/').pop(); // last / item; f_jname
                    _jsdoc.memberof = listDeleteAt(_jsdoc.path_o,_jsdoc.path_o.split('/').length,'/');
                    _jsdoc.memberof = _jsdoc.memberof.replaceAll('_','|').replaceAll('/','_');
                    let doc = `/**
 * (${_jsdoc.method.toUpperCase()}) ${_jsdoc.doc}
 * @method
 * @name ${func.replaceAll('_',' / ').replaceAll('|','_')}
 * @alias ${_jsdoc.method_name}
 * @memberof! ${_jsdoc.memberof}\n`;
                    // add params doc of function
                    let func_params = express.models[file].functions[func].params.split(',');
                    for (let param of func_params) {
                        let param_wstar = param.replaceAll('*','');
                        if (express.models[file].functions[func].param_doc[param_wstar]) {
                            let p_type = ccase.pascalize(express.models[file].functions[func].param_doc[param_wstar].type);
                            let p_desc = express.models[file].functions[func].param_doc[param_wstar].desc.trim();
                            doc += ` * @param {${p_type}} ${param} ${p_desc}\n`;
                        } else {
                            if (param.trim()=='id' && !param.includes('identificador')) {
                                doc += ` * @param {Int} ${param}\n`;
                            } else if (param.includes('base64')) {
                                doc += ` * @param {Base64} ${param}\n`;
                            } else {
                                doc += ` * @param {String} ${param}\n`;
                            }
                        }
                    }
                    // return
                    if (express.models[file].functions[func].param_doc.return) {
                        let p_type = ccase.pascalize(express.models[file].functions[func].param_doc.return.type);
                        let p_desc = express.models[file].functions[func].param_doc.return.desc.trim();
                        doc += `* @return {${p_type}} ${p_desc}\n`;
                    } else if (_jsdoc.doc.includes('@return')==false) {
                        doc += `* @return {object}\n`;
                    }
                    doc += ` */\n`;
                    // router code
                    if (express.models[file].functions[func].cache!='') {
                        doc += `router.${_jsdoc.method}('${_jsdoc.path}', cache('${express.models[file].functions[func].cache}'), async function(req, res, next) {
                            await ${file}.${func}(req, res);
                        });\n`;
                    } else {
                        doc += `router.${_jsdoc.method}('${_jsdoc.path}', async function(req, res, next) {
                            await ${file}.${func}(req, res);
                        });\n`;
                    }
                    // add doc to content if func is visible
                    if (express.models[file].functions[func].visible==true) {
                        content += doc+'\n';
                    }
                    // 
                }
            }
            // write exports
            content += `module.exports = router;\n`;
            // write file
            let target = path.join(this.x_state.dirs.routes,file+'.js');
            await this.writeFile(target,content);
        }
    }

    async createModels(express) {
        let path = require('path');
        for (let file in express.models) {
            let content = `//funciones para ruta ${file}\n`;
            if (this.x_state.config_node.aurora) {
                content += `const connectToDatabase = require('../db'); // initialize connection\n`;
            }
            //requires
            let requires = [];
            if (this.deploy_module.codeForModel) {
                let deploy_require = await this.deploy_module.codeForModel(express.models[file]);
                requires = [...requires,...deploy_require];
            }
            // add express models imports
            for (let imp in express.models[file].imports) {
                requires.push(`var ${imp.replaceAll('-','').replaceAll('@','').replaceAll('/','_')} = require('${imp}');`);
            }
            // write header of model
            content += `const Sequelize = require('sequelize'); // sequelize handler
            var moment = require('moment');
            //cache support
            const NodeCache = require("node-cache");
            const object_hash = require("object-hash");
            const cache = new NodeCache({ useClones:false });
            //
            var util = require('util');
            var async = require('async');
            var _ = require('underscore');
            var fs = require('fs');
            const fileType = require('file-type');
            var path = require('path');
            // requires globales segun requerimiento de codigos de funciones
            ${requires.join('\n')}
            // funciones para cada ruta
            var self = {};\n`;
            // add function code
            content += express.models[file].code;
            // replace db connection info on funcs init { file_init }
            for (let func in express.models[file].functions) {
                if (express.models[file].functions[func] && express.models[file].functions[func].used_models) {
                    let db_conn = `const { ${Object.keys(express.models[file].functions[func].used_models)} } = await connectToDatabase();`;
                    content = content.replaceAll(`{ ${func}_init }`,db_conn);
                } else {
                    // this can be true if cache had a func that now is cancelled
                }
            }
            // write exports
            content += `module.exports = self;\n`;
            // write file
            let target = path.join(this.x_state.dirs.models,file+'.js');
            await this.writeFile(target,content);
        }
    }

    async onEnd() {
        //execute deploy (npm install, etc) AFTER vue compilation (18-4-21: this is new)
        if (!this.errors_found) {
            if (!(await this.deploy_module.deploy()) && !this.x_state.central_config.componente) {
                this.x_console.outT({ message:'Something went wrong deploying, check the console, fix it and run again.', color:'red' });
                await this.deploy_module.post();
                // found errors deploying
                process.exit(100);
            } else {
                await this.deploy_module.post();
            }
        } else {
            //found errors compiling
            process.exit(50);
        }
    }

    async exists(dir_or_file) {
        let fs = require('fs').promises;
        try {
            await fs.access(dir_or_file);
            return true;
        } catch(e) {
            return false;
        }
    }

    async prettyCode(ext='js',content) {
        let prettier = require('prettier'), resp = content;
        if (ext=='js') {
            try {
                resp = prettier.format(resp, { parser: 'babel', useTabs:true, singleQuote:true });
            } catch(ee) {
                //this.debug(`error: could not format the JS file; trying js-beautify`);
                let beautify = require('js-beautify');
                let beautify_js = beautify.js;
                resp = beautify_js(resp,{});
            }
        }
        return resp;
    }

    async writeFile(file,content,encoding='utf-8') {
        let fs = require('fs').promises, prettier = require('prettier');
        let ext = file.split('.').splice(-1)[0].toLowerCase();
        let resp = content;
        if (ext=='js') {
            try {
                resp = prettier.format(resp, { parser: 'babel', useTabs:true, singleQuote:true });
            } catch(ee) {
                this.debug(`error: could not format the JS file; trying js-beautify`);
                let beautify = require('js-beautify');
                let beautify_js = beautify.js;
                resp = beautify_js(resp,{});
            }
        } else if (ext=='json') {
            resp = prettier.format(resp, { parser: 'json' });
        } else if (ext=='vue') {
            try {
                resp = prettier.format(resp.replaceAll(`="xpropx"`,''), { 
                    parser: 'vue',
                    htmlWhitespaceSensitivity: 'ignore',
                    useTabs: true,
                    printWidth: 2000,
                    embeddedLanguageFormatting: 'auto',
                    singleQuote: true,
                    trailingComma: 'none'
                });
            } catch(ee) {
                this.debug(`warning: could not format the vue file; trying vue-beautify`,ee);
                let beautify = require('js-beautify');
                let beautify_vue = beautify.html;
                resp = beautify_vue(resp,{});
            }

        } else if (ext=='css') {
            resp = prettier.format(resp, { parser: 'css' });
        }
        await fs.writeFile(file, resp, encoding);
    }

    //Transforms the processed nodes into files.
    async onCreateFiles(processedNodes) {
        let fs = require('fs').promises, path = require('path');
        //this.x_console.out({ message:'onCreateFiles', data:processedNodes });
        //this.x_console.out({ message:'x_state', data:this.x_state });
        await this._writeModelos();
        await this.createGitIgnore();
        //write .npmrc file for ffmpeg support
        await this.writeFile(path.join(this.x_state.dirs.app,'.npmrc'),`unsafe-perm=true`);
        this.debug('processing nodes');
        //console.log('PABLO debug x_state function general/login',this.x_state.functions.general_login);
        //console.log('PABLO debug create nodes',processedNodes);
        //group functions into express models (first folder is dad model)
        let express = await this.getExpressModels();
        //let express = { models:express_base.models, routes:express_base.routes }; // grouped functions by main path folder
        // add code to express models
        for (let thefile_num in processedNodes)  {
            let thefile = processedNodes[thefile_num];
            if (express.models[thefile.file]) {
                express.models[thefile.file].code = thefile.code;
            }
        }
        //console.log('PABLO debug EXPRESS models',express.models);
        await this.createAppJS(express);
        await this.createIndex(express);
        await this.createErrorTemplate();
        await this.createJSDoc();
        await this.createReadme();
        await this.createBinFile();
        await this.createRoutes(express);
        await this.createModels(express);
        // *************************
        // Additional steps
        // *************************
        //create package.json
        await this.createPackageJSON();
        //create package.json
        //await this.createPackageJSON();
        //create VSCode helpers
        //await this.createVSCodeHelpers();
        //create serverless.yml for deploy:sls - cfc:12881
        //await this.createServerlessYML();
        //execute deploy (npm install, etc) - moved to onEnd
        
    }

    // ************************
    // INTERNAL HELPER METHODS 
    // ************************

    /*
     * Returns true if a local server is running on the DSL defined port
     */
    async _isLocalServerRunning() {
        let is_reachable = require('is-port-reachable');
        let resp = await is_reachable(this.x_state.central_config.port);
        return resp;
    }

    /*
     * Reads the node called modelos and creates tables definitions and managing code (alias:database).
     */
    async _readModelos() {
        // @IDEA this method could return the insert/update/delete/select 'function code generators'
        this.debug('_readModelos');
        this.debug_time({ id: 'readModelos' });
        let modelos = await this.dsl_parser.getNodes({ text: 'modelos', level: 2, icon: 'desktop_new', recurse: true }); //nodes_raw:true	
        let tmp = { appname: this.x_state.config_node.name },
            fields_map = {};
        let resp = {
            tables: {},
            attributes: {},
            length: 0,
            doc: ''
        };
        // map our values to real database values 
        let type_map = {
            id: { value: 'INT AUTOINCREMENT PRIMARY KEY', alias: ['identificador', 'autoid', 'autonum', 'key'] },
            string: { value: 'STRING', alias: ['varchar', 'string'] },
            text: { value: 'TEXT', alias: ['texto', 'largo'] },
            smalltext: { value: `TEXT('tiny')`, alias: ['textochico', 'textocorto', 'corto'] },
            int: { value: 'INTEGER', alias: ['numero chico', 'small int', 'numero'] },
            float: { value: 'FLOAT', alias: ['decimal', 'real'] },
            boolean: { value: 'BOOLEAN', alias: ['boleano', 'true/false'] },
            date: { value: 'DATEONLY', alias: ['fecha'] },
            datetime: { value: 'DATETIME', alias: ['fechahora'] },
            blob: { value: 'BLOB', alias: ['binario', 'binary'] }
        };
        // expand type_map into fields_map
        Object.keys(type_map).map(function(x) {
            let aliases = type_map[x].alias;
            aliases.push(x);
            aliases.map(y => { fields_map[y] = type_map[x].value });
        });
        // search real modelos nodes (ignore folders)
        let modelos_x = [];
        if (modelos.length > 0) {
            let ccase = require('fast-case');
            for (let main of modelos[0].nodes) {
                if (main.icons.includes('list')) {
                    for (let child of main.nodes) {
                        let with_folder = {...child};
                        //@change: this is a breaking change - 23-may-21
                        with_folder.text = ccase.camelize(main.text)+'/'+ccase.camelize(child.text);
                        modelos_x.push(with_folder);  
                    }
                } else {
                    // this is a real modelo node
                    modelos_x.push(main);
                }
            }
        }
        modelos = [{nodes:modelos_x}];
        // parse nodes into tables with fields
        if (modelos.length > 0) {
            //modelos[0].attributes.map(x=>{ resp.attributes={...resp.attributes,...x} }); //modelos attributes
            resp.attributes = {...modelos[0].attributes };
            resp.doc = modelos[0].text_note;
            resp.length = modelos[0].nodes.length;
            let extract = require('extractjs')();
            for (let table of modelos[0].nodes) {
                let fields = {...table.attributes }; //table.attributes.map(x=>{ fields={...fields,...x} }); //table attributes
                resp.tables[table.text] = { fields: {} }; //create table
                tmp.sql_fields = [];
                for (let field in fields) {
                    //console.log('fields_map',{field,fields});
                    if (fields[field].includes('(')) {
                        let parts = extract(`{type}({amount})`,fields[field]);
                        resp.tables[table.text].fields[field] = fields_map[parts.type]+`(${parts.amount})`; //assign field with mapped value
                        tmp.sql_fields.push(field + ' ' + fields_map[fields[field]]);
                    } else if (field.charAt(0)!=':') {
                        resp.tables[table.text].fields[field] = fields_map[fields[field]]; //assign field with mapped value
                        tmp.sql_fields.push(field + ' ' + fields_map[fields[field]]);
                    }
                }
                resp.tables[table.text].sql = `CREATE TABLE ${table.text}(${tmp.sql_fields.join(',')})`;
                // test special attrs
                if (fields[':dbname']) resp.tables[table.text].db = table[':dbname'];
                if (fields[':tipo']) resp.tables[table.text].type = table[':tipo'];
                if (fields[':type']) resp.tables[table.text].type = table[':type'];
                if (fields[':tipo']) resp.tables[table.text].type = table[':tipo'];
                if (fields[':index']) {
                    if (!resp.tables[table.text].indexes) resp.tables[table.text].indexes=[];
                    resp.tables[table.text].indexes.push({
                        name: await this.hash(table.text+'_'+table[':index']),
                        unique: false,
                        fields: fields[':index'].split(',')
                    });
                }
                if (fields[':index_unique']) {
                    if (!resp.tables[table.text].indexes) resp.tables[table.text].indexes=[];
                    resp.tables[table.text].indexes.push({
                        name: await this.hash(table.text+'_'+table[':index_unique']),
                        unique: true,
                        fields: fields[':index_unique'].split(',')
                    });
                }
                //
                await this.setImmediatePromise(); //@improved
            }
        }
        // create virtual table 'if' central node 'log'='modelo
        if (this.x_state.central_config.log && this.x_state.central_config.log.includes('model')) {
            resp.tables['console_log'] = {
                fields: {
                    id: 'INT AUTOINCREMENT PRIMARY KEY',
                    class: 'STRING',
                    method: 'STRING',
                    message: 'STRING',
                    date: 'DATE'
                }
            };
        }
        // add sequelize package
        this.x_state.npm['sequelize'] = '*';
        this.debug_timeEnd({ id: 'readModelos' });
        // return 
        return resp;
    }

    async _writeModelos() {
        this.debug('_writeModelos');
        this.debug_time({ id: 'writeModelos' });
        let path = require('path'), fs = require('fs').promises;
        // ******************************************************
        // create db_models sequelize schema files @todo
        // ******************************************************
        for (let table in this.x_state.models.tables) {
            // define file name
            let target_file = [], db_name='';
            
            if (table.includes('/')) {
                target_file.push(table.split('/')[0]);
                target_file.push(table.split('/').pop()+'.js');
                db_name = target_file[0] + '_' + target_file[1].replace('.js','');
            } else {
                target_file.push(table+'.js');
                db_name = table;
            }
            let target = path.join(this.x_state.dirs.db_models,target_file.join('/'));
            // create target folder
            let jfolder = path.dirname(target);
            try {
                await fs.mkdir(jfolder, { recursive:true });
            } catch(errdir) {
            }
            // content
            let fields = this.x_state.models.tables[table].fields;
            let model = {};
            // map types depending on db type (modelos: central key)
            let map = {
                    'INT AUTOINCREMENT PRIMARY KEY': {
                        type: 'type.INTEGER',
                        primaryKey: true,
                        autoIncrement: true
                    },
                    'INT PRIMARY KEY': {
                        type: 'type.INTEGER',
                        primaryKey: true,
                        autoIncrement: false
                    },
                    'INTEGER': 'type.INTEGER',
                    'STRING': 'type.STRING',
                    'TEXT': 'type.TEXT',
                    'TEXT(\'tiny\')': `type.TEXT('tiny')`,
                    'FLOAT': 'type.FLOAT',
                    'BOOLEAN': 'type.BOOLEAN',
                    'DATEONLY': 'type.DATE',
                    'DATETIME': 'type.DATE',
                    'BLOB': 'type.BLOB'
            };
            let extract = require('extractjs')();
            //console.log('pablo dump fields',{table,fields});
            for (let key in fields) {
                if (fields[key] in map) {
                    model[key] = map[fields[key]];
                } else if (fields[key] && fields[key].includes('(')) {
                    //example string(10)
                    let elements = extract(`{field}({amount})`,fields[key]);
                    if (elements.field in map) {
                        model[key] = map[elements.field]+`(${elements.amount})`;
                    }
                }
            }
            //add indexes
            let content = ``;
            if (this.x_state.models.tables[table].indexes) {
                //write model with indexes
                let indexes = { indexes:this.x_state.models.tables[table].indexes };
                content = `module.exports = (sequelize, type) => {
                    return sequelize.define('${db_name}', ${this.jsDump(model,'type.')}, ${this.jsDump(indexes)});
                }`;
            } else {
                //write model without indexes
                content = `module.exports = (sequelize, type) => {
                    return sequelize.define('${db_name}', ${this.jsDump(model,'type.')});
                }`;
            }
            // write file
            await this.writeFile(target,content);
        }
        // ******************************************************
        // create db.js for 'aurora' if defined on config node
        // ******************************************************
        if (this.x_state.config_node.aurora) {
            this.x_state.npm['mysql2'] = '*';
            this.x_state.npm['sequelize'] = '*';
            let content = `const Sequelize = require('sequelize');\n`;
            for (let table in this.x_state.models.tables) {
                if (table.includes('/')) {
                    let info = { folder:'', table:'' };
                    info.folder = table.split('/')[0];
                    info.table = table.split('/').pop();
                    content += `const db_${info.folder}_${info.table} = require('./db_models/${info.folder}/${info.table}');\n`;
                } else {
                    content += `const db_${table} = require('./db_models/${table}');\n`;  
                }
            }
            let seq_config = {
                logging: (this.x_state.central_config.dblog==true)?'func:logging':false,
                dialect: 'mysql',
                dialectOptions: {
                    connectTimeout: 60000
                },
                define: {
                    freezeTableName: true
                },
                pool: {
                    max: this.x_state.central_config.pool_max,
                    min: 1,
                    acquire: 12000,
                    idle: 12000,
                    evict: 12000
                },
                operatorAliases: false,
                host: 'process.env.AURORA_HOST',
                port: 'process.env.AURORA_PORT'
            };
            if (this.x_state.central_config.dblog==true) {
                seq_config.benchmark = true;
            }
            content += `const colors = require('colors/safe');\n`;
            content += `const logging = function(logStr, execTime, options) {
                if (!options) {
                    options = execTime;
                    execTime = undefined;
                }
                    
                let col = null;
                switch (options.type) {
                    case 'SELECT':
                        col = colors.blue.bold;
                        break;
                    case 'UPDATE':
                        col = colors.yellow.bold;
                        break;
                    case 'INSERT':
                        col = colors.green.bold;
                        break;
                    default:
                        col = colors.white.bold;
                        break;
                }
                if (execTime) {
                    if (execTime >= 10) {
                        col = colors.red.bold;
                        console.log(colors.magenta.bold(\`[\${execTime} ms]\`), col(logStr));
                    } else {
                        console.log(col(logStr));
                    }
                }
            }\n`;
            content += `const sequelize = new Sequelize(
                process.env.AURORA_NAME,
                process.env.AURORA_USER,
                process.env.AURORA_PASSWORD,
                ${this.jsDump(seq_config).replace(`'func:logging'`,`logging`)}
            );
            // check if given database exists, or create it
            sequelize.query("CREATE DATABASE IF NOT EXISTS "+process.env.AURORA_NAME).then(function(){});\n`;
            let models = [];
            for (let table in this.x_state.models.tables) {
                if (table.includes('/')) {
                    let info = { folder:'', table:'' };
                    info.folder = table.split('/')[0];
                    info.table = table.split('/').pop();
                    models.push(`${info.folder}_${info.table}`);
                    content += `const ${info.folder}_${info.table} = db_${info.folder}_${info.table}(sequelize, Sequelize);\n`;
                } else {
                    models.push(info.table);
                    content += `const ${table} = db_${table}(sequelize, Sequelize);;\n`;  
                }
            }
            // add closing code
            content += `const Models = { ${models.join(',')} }\n
            const connection = {};

            module.exports = async() => {
                if (connection.isConnected) {
                    console.log('=> Using existing connection.');
                    return Models;
                }

                await sequelize.sync({ alter:${this.x_state.central_config.dbalter} });
                await sequelize.authenticate()
                connection.isConnected = true;
                console.log('=> Created a new connection.');
                return Models;
            }
            `;
            // write db.js file
            let target = path.join(this.x_state.dirs.app,'db.js');
            await this.writeFile(target,content);
        }
        this.debug_timeEnd({ id: 'writeModelos' });
    }

    /* 
     * Grabs central node configuration information
     */
    async _readCentralConfig() {
        this.debug('_readCentralConfig');
        let central = await this.dsl_parser.getNodes({ level: 1, recurse: false });
        //this.debug('central search',central);
        // set defaults
        let resp = {
            cloud: 'aws',
            type: 'simple',
            i18n: false,
            log: 'console',
            debug: false,
            dblog: true,
            dbalter: true,
            deploy: false,
            stage: '',
            timeout: 30,
            modelos: 'aurora',
            pool_max: 10,
            doc: false,
            rtc: false,
            'rtc:admin':'',
            port: 8081,
            git: true,
            readme: central[0].text_note.trim(),
            'keep-alive': true,
            'keep-warm': true,
            ':cache': this.x_config.cache,
            ':keywords': '',
            ':author': 'Punto Origen SpA',
            ':license': 'MIT',
            ':github': '',
            ':version': '1.0.0',
            ':description': central[0].text_note,
            default_face: central[0].font.face,
            default_size: central[0].font.size,
            apptitle: central[0].text
        };
        // overwrite default resp with info from central node
        //resp = {...resp, ...central[0].attributes };
        //bit slower but transforms string booleans (19-4-21)
        let values = {};
        for (let xz in central[0].attributes) {
            let x = central[0].attributes[xz];
            if (x=='true') { 
                x=true;
            } else if (x=='false') {
                x=false;
            }
            values = {...values,...{[xz]:x}};
        }
        resp = {...resp, ...values };
        /*central[0].attributes.map(function(x) {
        	resp = {...resp,...x};
        });*/
        if (resp.dominio) {
            resp.service_name = resp.dominio.replace(/\./g, '').toLowerCase();
        } else {
            resp.service_name = resp.apptitle;
        }
        if (!resp[':cache']) this.x_config.cache = false; // disables cache when processing nodes (@todo)
        // return
        return resp;
    }

    /* helper for readConfig and secrets extraction */
    configFromNode(resp,key) {
        if (key.icons.includes('button_cancel')==false) {                
            if (Object.keys(key.attributes).length > 0) {
                // prepare config key
                let config_key = key.text.toLowerCase().replace(/ /g, '');
                //alt1 let values = {...key.attributes }; 
                //alt2, bit slower but considers booleans as string
                let values = {};
                for (let xz in key.attributes) {
                    let x = key.attributes[xz];
                    if (x=='true') { 
                        x=true;
                    } else if (x=='false') {
                        x=false;
                    }
                    values = {...values,...{[xz]:x}};
                }
                resp[config_key] = values;
                // mark secret status true if contains 'password' icon
                if (key.icons.includes('password')) {
                    resp[config_key][':secret'] = true;
                    if (!resp['::secrets']) resp['::secrets']=[];
                    resp['::secrets'].push(key); //add key as secret
                }
                // add link attribute if defined
                if (key.link != '') resp[config_key][':link'] = key.link;

            } else if (key.nodes.length > 0) {
                resp[key.text] = key.nodes[0].text;
            } else if (key.link != '') {
                resp[key.text] = key.link;
            }
            //
            if (key.text==':secrets' && key.icons.includes('password')) {
                resp[':secrets'] = key.text_note.replaceAll('\n','').trim();
            }
        }
        return resp;
    }

    /*
     * Grabs the configuration from node named 'config'
     */
    async _readConfig(delete_secrets=true) {
        this.debug('_readConfig');
        let path = require('path'), fs = require('fs').promises;
        let resp = { id: '', meta: [], seo: {} },
            config_node = {};
        let search = await this.dsl_parser.getNodes({ text: 'config', level: 2, icon: 'desktop_new', recurse: true });
        //this.debug({ message:'search says',data:search, prefix:'_readConfig,dim' });
        //let secrets = []; // secret nodes for encrypted export
        //
        if (search.length > 0) {
            config_node = search[0];
            // define default font_face
            if (!delete_secrets) resp[':id'] = config_node.id;
            resp.default_face = config_node.font.face;
            resp.default_size = config_node.font.size;
            // apply children nodes as keys/value for resp
            for (let key of config_node.nodes) {
                // apply keys as config keys (standard config node by content types)
                resp = {...resp,...this.configFromNode(resp,key)};
                //console.log('dump:'+key.text,this.configFromNode(key));
                //
            }
        }
        // assign dsl file folder name+filename if node.name is not given
        if (!resp.name) {
            let dsl_folder = path.dirname(path.resolve(this.x_flags.dsl));
            let parent_folder = path.resolve(dsl_folder, '../');
            let folder = dsl_folder.replace(parent_folder, '');
            resp.name = folder.replace('/', '').replace('\\', '') + '_' + path.basename(this.x_flags.dsl, '.dsl');
            //console.log('folder:',{folder,name:resp.name});
            //this.x_flags.dsl
        }
        // create id if not given
        if (!resp.id) resp.id = 'com.puntorigen.' + resp.name;
        // *********************************************
        if (delete_secrets==true) delete resp[':secrets'];
        return resp;
    }

    async getParentNodes(id = this.throwIfMissing('id'), exec = false) {
        let parents = await this.dsl_parser.getParentNodesIDs({ id, array: true });
        let resp = [];
        for (let parent_id of parents) {
            let node = await this.dsl_parser.getNode({ id: parent_id, recurse: false });
            let command = await this.findValidCommand({ node, object: exec });
            if (command) resp.push(command);
            await setImmediatePromise(); //@improved
        }
        return resp;
    }

    //objeto to attributes tag version
    struct2params(struct = this.throwIfMissing('id')) {
        let resp = [],
            tmp = {...struct };
        // pre-process
        if ('aos' in tmp) {
            let aos_p = struct['aos'].split(',');
            if (aos_p.length == 3) {
                tmp['data-aos'] = aos_p[0];
                tmp['data-aos-duration'] = aos_p[1];
                tmp['data-aos-delay'] = aos_p[2];
            } else {
                tmp['data-aos'] = aos_p[0];
                tmp['data-aos-duration'] = aos_p[1];
            }
            delete tmp['aos'];
        }
        // process
        for (let [key, value] of Object.entries(tmp)) {
            if (value == null) {
                //needed cause cheerio assigns empty values to props, and vue props don't have values
                //little hack that works together with writeFile method
                resp.push(`${key}="xpropx"`); 
            } else if (typeof value !== 'object' && typeof value !== 'function' && typeof value !== 'undefined') {
                resp.push(`${key}="${value}"`);
            } else if (typeof value === 'object') {
                //serialize value
                resp.push(`${key}="${this.jsDump(value)}"`);
            }
        }
        return resp.join(' ');
    }

    //serializes the given obj escaping quotes from values containing js code
    jsDump(obj,leave_as_is_if_contains='') {
        let resp='';
        let isNumeric = function(n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        };
        let escape = function(obi) {
            let nuevo = '', ob = obi;
            //special escapes first
            if (typeof ob === 'string') ob = ob.replaceAll('{now}','new Date()');
            //
            if (typeof ob === 'number') {
                nuevo += ob;
            } else if (typeof ob === 'boolean') {
                nuevo += ob;
            } else if (typeof ob === 'string' &&
                ob.substr(0,2)=='**' && ob.substr(ob.length-2)=='**') {
                nuevo += ob.replaceAll('**',''); //escape single ** vars 21-abr-21
            } else if ((typeof ob === 'string') && (
                ob.charAt(0)=='!' || 
                ob.indexOf('this.')!=-1 || 
                ob.indexOf('new ')!=-1 || 
                ob.indexOf(`'`)!=-1 || 
                ob.indexOf('`')!=-1 || 
                (leave_as_is_if_contains!='' && ob.indexOf(leave_as_is_if_contains)!=-1) || 
                ob.includes('process.') || 
                (ob.charAt(0)!='0' && isNumeric(ob)) ||
                ob=='0' || 
                ob=='true' || ob=='false')
                ) {
                nuevo += ob;
            } else if (typeof ob === 'string') {
                nuevo += `'${ob}'`;
            } else {
                nuevo += ob;
            }
            return nuevo;
        };
        if (Array.isArray(obj)) {
            let tmp = [];
            for (let item in obj) {
                tmp.push(this.jsDump(obj[item],leave_as_is_if_contains));
            }
            resp = `[${tmp.join(',')}]`;
        } else if (typeof obj === 'object') {
            let tmp=[];
            for (let llave in obj) {
                let llavet = llave;
                if (llavet.includes('-') && llavet.includes(`'`)==false) llavet = `'${llave}'`;
                let nuevo = `${llavet}: `;
                let valor = obj[llave];
                if (typeof valor === 'object' || Array.isArray(valor)) {
                    nuevo += this.jsDump(valor,leave_as_is_if_contains);
                } else {
                    nuevo += escape(valor);
                }
                tmp.push(nuevo);
            }
            resp = `{\n${tmp.join(',')}\n}`;
        } else if (typeof(obj) === 'string') {
            resp = escape(obj);
        } else {
            resp = obj;
        }
        return resp;
    }

    // hash helper method
    async hash(thing) {
        let resp = await this.dsl_parser.hash(thing);
        return resp;
    }

    // atLeastNode
    atLeastNode(r) {
        const n = process.versions.node.split('.').map(x => parseInt(x, 10));
        r = r.split('.').map(x => parseInt(x, 10));
        return n[0] > r[0] || (n[0] === r[0] && (n[1] > r[1] || (n[1] === r[1] && n[2] >= r[2])));
    }

    setImmediatePromise() {
        //for preventing freezing node thread within loops (fors)
        return new Promise((resolve) => {
          setImmediate(() => resolve());
        });
    }
}