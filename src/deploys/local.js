/**
* Local Deploy: A class to help deploy eb_dsl locally.
* @name 	local
* @module 	local
**/
import base_deploy from './base_deploy'
//const base_deploy = require('./base_deploy');

export default class local extends base_deploy {

    constructor({ context={} }={}) {
        super({ context, name:'Local' });
    }

    async setEnvs(envs) {
        return [...envs,'START_TYPE=development'];
    }

    async deploy() {
        let build={};
        if ((await this._isLocalServerRunning())==false) {
            this.context.x_console.title({ title:'Deploying local NodeJS server instance', color:'green' });
            await this.logo();
            //only launch nuxt server if its not running already
            // builds the app
            build.try_build = await this.base_build(); 
            if (build.try_build.length>0) {
                this.context.x_console.outT({ message:`There was an error building the project.`, color:'red' });
                return false;
            }
            
            if (this.context.x_config.nodeploy && this.context.x_config.nodeploy==true) {
                this.context.x_console.outT({ message:`Aborting final deployment as requested`, color:'brightRed'});
                return true;
            } else {
                build.deploy_local = await this.run();
                if (build.deploy_local.length>0) {
                    this.context.x_console.outT({ message:`There was an error deploying locally.`, color:'red', data:build.deploy_local.toString()});
                    return false;
                }
            }
        } else {
            this.context.x_console.title({ title:'Updating local running NodeJS instance', color:'green' });
            await this.logo();
            this.context.x_console.outT({ message:`Project updated.`, color:'green' });
        }
        return true;
    }

    async run() {
        //issue npm run dev
        let errors=[];
        let spawn = require('await-spawn');
        let spinner = this.context.x_console.spinner({ message:'Deploying local instance' });
        //this.debug('Local deploy');
        spinner.start('Deploying local instance');
        try {
            //launch in a new terminal
            await this.launchTerminal('npm',['run','dev'],this.context.x_state.dirs.app);
            //results.git_add = await spawn('npm',['run','dev'],{ cwd:this.x_state.dirs.app });
            spinner.succeed('NodeJS Express launched successfully');
        } catch(gi) { 
            spinner.fail('Project failed to launch');
            errors.push(gi);
        }
        return errors;
    }

    async codeForModel(model) {
        //express = {models,routes}
        //returns array with records of lines of code
        let resp = [];
        //aws config requirements
        if (this.context.x_state.npm['aws-sdk']) {
            let aws_data = {};
            if (!this.context.x_state.config_node.aws) {
                this.context.x_state.npm['aws-get-credentials'] = '*';
                resp.push(`const AWS = require('aws-sdk');
                (async function() {
                    const { getAWSCredentials } = require('aws-get-credentials');
                    AWS.config.credentials = await getAWSCredentials();;
                })();
                const AWS_s3 = new AWS.S3();`);
            } else {
                aws_data = {
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