/**
* Base Deploy: A class to define deployments for eb_dsl.
* @name 	base_deploy
* @module 	base_deploy
**/
export default class base_deploy {

	constructor({ context={}, name='base_deploy' }={}) {
        this.context = context;
        this.name = name;
    }

    async logo({ name=this.name, config={} }={}) {
        let cfonts = require('cfonts');
        cfonts.say(name, {...{ font:'block', gradient:'red,blue' },...config });
    }

    async run() {
        return true;
    }

    async deploy() {
        let errors=[];
        let spinner = this.context.x_console.spinner({ message:`Deploying ${this.name} instance` });
        return errors;
    }
    
    // building methods
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
        // issue npm run build
        spinner.start(`Building NodeJS project`);
        try {
            if (ci.isCI==false) {  
                npm.build = await spawn('npm',['run','build'],{ cwd:this.context.x_state.dirs.app });
            } else {
                npm.build = await spawn('npm',['run','build'],{ cwd:this.context.x_state.dirs.app, stdio:'inherit' });
            }
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
        return errors;
    }

    //****************************
    // onPrepare and onEnd steps
    //****************************
    async pre() {
    }
    async post() {
    }

    // config hooks
    async setEnvs(envs) {
        return envs; //array with already set env vars
    }

    async codeForModel(model) {
        //express = {models,routes}
        //returns array with records of lines of code
        return [];
    }

    // HELPER methods
    async exists(dir_or_file) {
        let fs = require('fs').promises;
        try {
            await fs.access(dir_or_file);
            return true;
        } catch(e) {
            return false;
        }
    }

    async _isLocalServerRunning(port=this.context.x_state.central_config.port) {
        let is_reachable = require('is-port-reachable');
        let resp = await is_reachable(port);
        return resp;
    }

    async launchTerminal(cmd,args=[],basepath) {
        let spawn = require('await-spawn');
        let args_p = '';
        let resp={ error:false };
        if (basepath) { 
            args_p = `sleep 2; clear; cd ${basepath} && ${cmd} ${args.join(' ')}`;
        } else {
            args_p = 'sleep 2; clear; '+cmd+' '+args.join(' ')
        }
        try {
            resp = await spawn('npx',['terminal-tab',args_p]);
        } catch(e) {
            resp = {...e,...{error:true}};
        }
        return resp;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}