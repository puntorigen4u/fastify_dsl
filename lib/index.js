(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.fastify_dsl = factory());
})(this, (function () { 'use strict';

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);

      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  /**
  * Base Deploy: A class to define deployments for eb_dsl.
  * @name 	base_deploy
  * @module 	base_deploy
  **/
  class base_deploy {
    constructor() {
      var {
        context = {},
        name = 'base_deploy'
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      this.context = context;
      this.name = name;
    }

    logo() {
      var _arguments = arguments,
          _this = this;

      return _asyncToGenerator(function* () {
        var {
          name = _this.name,
          config = {}
        } = _arguments.length > 0 && _arguments[0] !== undefined ? _arguments[0] : {};

        var cfonts = require('cfonts');

        cfonts.say(name, _objectSpread2(_objectSpread2({}, {
          font: 'block',
          gradient: 'red,blue'
        }), config));
      })();
    }

    run() {
      return _asyncToGenerator(function* () {
        return true;
      })();
    }

    deploy() {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        var errors = [];

        _this2.context.x_console.spinner({
          message: "Deploying ".concat(_this2.name, " instance")
        });

        return errors;
      })();
    } // building methods


    base_build() {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        // builds the project
        var ci = require('ci-info');

        var spawn = require('await-spawn'),
            path = require('path'),
            fs = require('fs').promises; //let ora = require('ora');


        var node_modules_final = path.join(_this3.context.x_state.dirs.app, 'node_modules');
        var node_package = path.join(_this3.context.x_state.dirs.app, 'package.json');
        var npm = {},
            errors = [];

        _this3.context.x_console.outT({
          message: "Building project",
          color: 'cyan'
        });

        var spinner = _this3.context.x_console.spinner({
          message: 'Building project'
        });

        var node_modules_exist = yield _this3.exists(node_modules_final);
        var node_package_exist = yield _this3.exists(node_package);

        if (node_modules_exist && node_package_exist) {
          //test if every package required is within node_modules
          spinner.start("Some npm packages where installed; checking ..");
          var pkg = JSON.parse(yield fs.readFile(node_package, 'utf-8'));
          var all_ok = true;

          for (var pk in pkg.dependencies) {
            var tst_dir = path.join(_this3.context.x_state.dirs.app, 'node_modules', pk);
            var tst_exist = yield _this3.exists(tst_dir);
            if (!tst_exist) all_ok = false;
          }

          node_modules_exist = all_ok;

          if (all_ok) {
            spinner.succeed('Using existing npm packages');
          } else {
            spinner.warn('Some packages are new, requesting them');
          }
        } // issue npm install (400mb)


        if (!node_modules_exist) {
          spinner.start("Installing npm packages"); //this.x_console.outT({ message:`Installing npm packages` });

          try {
            npm.install = yield spawn('npm', ['install'], {
              cwd: _this3.context.x_state.dirs.app
            }); //, stdio:'inherit'

            spinner.succeed("npm install succesfully");
          } catch (n) {
            npm.install = n;
            spinner.fail('Error installing npm packages');
            errors.push(n);
          }
        } // issue npm run build


        spinner.start("Building NodeJS project");

        try {
          if (ci.isCI == false) {
            npm.build = yield spawn('npm', ['run', 'build'], {
              cwd: _this3.context.x_state.dirs.app
            });
          } else {
            npm.build = yield spawn('npm', ['run', 'build'], {
              cwd: _this3.context.x_state.dirs.app,
              stdio: 'inherit'
            });
          }

          spinner.succeed('Project built successfully');
        } catch (nb) {
          npm.build = nb;
          spinner.fail('Build failed');

          if (ci.isCI == false) {
            _this3.context.x_console.out({
              message: "Building NodeJS again to show error in console",
              color: 'red'
            }); //build again with output redirected to console, to show it to user


            try {
              console.log('\n');
              npm.build = yield spawn('npm', ['run', 'dev'], {
                cwd: _this3.context.x_state.dirs.app,
                stdio: 'inherit',
                timeout: 15000
              });
            } catch (eg) {}
          }

          errors.push(nb);
        }

        return errors;
      })();
    } //****************************
    // onPrepare and onEnd steps
    //****************************


    pre() {
      return _asyncToGenerator(function* () {})();
    }

    post() {
      return _asyncToGenerator(function* () {})();
    } // config hooks


    setEnvs(envs) {
      return _asyncToGenerator(function* () {
        return envs; //array with already set env vars
      })();
    }

    codeForModel(model) {
      return _asyncToGenerator(function* () {
        //express = {models,routes}
        //returns array with records of lines of code
        return [];
      })();
    } // HELPER methods


    exists(dir_or_file) {
      return _asyncToGenerator(function* () {
        var fs = require('fs').promises;

        try {
          yield fs.access(dir_or_file);
          return true;
        } catch (e) {
          return false;
        }
      })();
    }

    _isLocalServerRunning() {
      var _arguments2 = arguments,
          _this4 = this;

      return _asyncToGenerator(function* () {
        var port = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : _this4.context.x_state.central_config.port;

        var is_reachable = require('is-port-reachable');

        var resp = yield is_reachable(port);
        return resp;
      })();
    }

    launchTerminal(cmd) {
      var _arguments3 = arguments;
      return _asyncToGenerator(function* () {
        var args = _arguments3.length > 1 && _arguments3[1] !== undefined ? _arguments3[1] : [];
        var basepath = _arguments3.length > 2 ? _arguments3[2] : undefined;

        var spawn = require('await-spawn');

        var args_p = '';
        var resp = {
          error: false
        };

        if (basepath) {
          args_p = "sleep 2; clear; cd ".concat(basepath, " && ").concat(cmd, " ").concat(args.join(' '));
        } else {
          args_p = 'sleep 2; clear; ' + cmd + ' ' + args.join(' ');
        }

        try {
          resp = yield spawn('npx', ['terminal-tab', args_p]);
        } catch (e) {
          resp = _objectSpread2(_objectSpread2({}, e), {
            error: true
          });
        }

        return resp;
      })();
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

  }

  class local extends base_deploy {
    constructor() {
      var {
        context = {}
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        context,
        name: 'Local'
      });
    }

    setEnvs(envs) {
      return _asyncToGenerator(function* () {
        return [...envs, 'START_TYPE=development'];
      })();
    }

    deploy() {
      var _this = this;

      return _asyncToGenerator(function* () {
        var build = {};

        if ((yield _this._isLocalServerRunning()) == false) {
          _this.context.x_console.title({
            title: 'Deploying local NodeJS server instance',
            color: 'green'
          });

          yield _this.logo(); //only launch nuxt server if its not running already
          // builds the app

          build.try_build = yield _this.base_build();

          if (build.try_build.length > 0) {
            _this.context.x_console.outT({
              message: "There was an error building the project.",
              color: 'red'
            });

            return false;
          }

          if (_this.context.x_config.nodeploy && _this.context.x_config.nodeploy == true) {
            _this.context.x_console.outT({
              message: "Aborting final deployment as requested",
              color: 'brightRed'
            });

            return true;
          } else {
            build.deploy_local = yield _this.run();

            if (build.deploy_local.length > 0) {
              _this.context.x_console.outT({
                message: "There was an error deploying locally.",
                color: 'red',
                data: build.deploy_local.toString()
              });

              return false;
            }
          }
        } else {
          _this.context.x_console.title({
            title: 'Updating local running NodeJS instance',
            color: 'green'
          });

          yield _this.logo();

          _this.context.x_console.outT({
            message: "Project updated.",
            color: 'green'
          });
        }

        return true;
      })();
    }

    run() {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        //issue npm run dev
        var errors = [];

        require('await-spawn');

        var spinner = _this2.context.x_console.spinner({
          message: 'Deploying local instance'
        }); //this.debug('Local deploy');


        spinner.start('Deploying local instance');

        try {
          //launch in a new terminal
          yield _this2.launchTerminal('npm', ['run', 'dev'], _this2.context.x_state.dirs.app); //results.git_add = await spawn('npm',['run','dev'],{ cwd:this.x_state.dirs.app });

          spinner.succeed('NodeJS Express launched successfully');
        } catch (gi) {
          spinner.fail('Project failed to launch');
          errors.push(gi);
        }

        return errors;
      })();
    }

    codeForModel(model) {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        //express = {models,routes}
        //returns array with records of lines of code
        var resp = []; //aws config requirements

        if (_this3.context.x_state.npm['aws-sdk']) {
          var aws_data = {};

          if (!_this3.context.x_state.config_node.aws) {
            _this3.context.x_state.npm['aws-get-credentials'] = '*';
            resp.push("const AWS = require('aws-sdk');\n                (async function() {\n                    const { getAWSCredentials } = require('aws-get-credentials');\n                    AWS.config.credentials = await getAWSCredentials();;\n                })();\n                const AWS_s3 = new AWS.S3();");
          } else {
            aws_data = {
              accessKeyId: _this3.context.x_state.config_node.aws.access,
              secretAccessKey: _this3.context.x_state.config_node.aws.secret
            };

            if (_this3.context.x_state.config_node.aws.region) {
              aws_data.region = _this3.context.x_state.config_node.aws.region;
            }

            resp.push("const AWS = require('aws-sdk');\n                AWS.config.update(".concat(_this3.context.jsDump(aws_data), ");\n                const AWS_s3 = new AWS.S3();"));
          }
        }

        return resp;
      })();
    }

  }

  class eb extends base_deploy {
    constructor() {
      var {
        context = {}
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        context,
        name: 'AWS EB'
      });
    }

    logo() {
      return _asyncToGenerator(function* () {
        var asciify = require('asciify-image'),
            path = require('path');

        var aws = path.join(__dirname, 'assets', 'aws.png');
        var logo_txt = yield asciify(aws, {
          fit: 'width',
          width: 25
        });
        console.log(logo_txt);
      })();
    }

    base_build() {
      var _this = this;

      return _asyncToGenerator(function* () {
        // builds the project
        var ci = require('ci-info');

        var spawn = require('await-spawn'),
            path = require('path'),
            fs = require('fs').promises; //let ora = require('ora');


        var node_modules_final = path.join(_this.context.x_state.dirs.app, 'node_modules');
        var node_package = path.join(_this.context.x_state.dirs.app, 'package.json');
        var npm = {},
            errors = [];

        _this.context.x_console.outT({
          message: "Building project",
          color: 'cyan'
        });

        var spinner = _this.context.x_console.spinner({
          message: 'Building project'
        });

        var node_modules_exist = yield _this.exists(node_modules_final);
        var node_package_exist = yield _this.exists(node_package);

        if (node_modules_exist && node_package_exist) {
          //test if every package required is within node_modules
          spinner.start("Some npm packages where installed; checking ..");
          var pkg = JSON.parse(yield fs.readFile(node_package, 'utf-8'));
          var all_ok = true;

          for (var pk in pkg.dependencies) {
            var tst_dir = path.join(_this.context.x_state.dirs.app, 'node_modules', pk);
            var tst_exist = yield _this.exists(tst_dir);
            if (!tst_exist) all_ok = false;
          }

          node_modules_exist = all_ok;

          if (all_ok) {
            spinner.succeed('Using existing npm packages');
          } else {
            spinner.warn('Some packages are new, requesting them');
          }
        } // issue npm install (400mb)


        if (!node_modules_exist) {
          spinner.start("Installing npm packages"); //this.x_console.outT({ message:`Installing npm packages` });

          try {
            npm.install = yield spawn('npm', ['install'], {
              cwd: _this.context.x_state.dirs.app
            }); //, stdio:'inherit'

            spinner.succeed("npm install succesfully");
          } catch (n) {
            npm.install = n;
            spinner.fail('Error installing npm packages');
            errors.push(n);
          }
        } // issue npm run build (just docs; not working on CI 16-jun-21)


        if (ci.isCI == false) {
          spinner.start("Building NodeJS project");

          try {
            npm.build = yield spawn('npm', ['run', 'build'], {
              cwd: _this.context.x_state.dirs.app
            });
            spinner.succeed('Project built successfully');
          } catch (nb) {
            npm.build = nb;
            spinner.fail('Build failed');

            if (ci.isCI == false) {
              _this.context.x_console.out({
                message: "Building NodeJS again to show error in console",
                color: 'red'
              }); //build again with output redirected to console, to show it to user


              try {
                console.log('\n');
                npm.build = yield spawn('npm', ['run', 'dev'], {
                  cwd: _this.context.x_state.dirs.app,
                  stdio: 'inherit',
                  timeout: 15000
                });
              } catch (eg) {}
            }

            errors.push(nb);
          }
        }

        return errors;
      })();
    }

    deploy() {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        var build = {};

        _this2.context.x_console.title({
          title: 'Deploying to Amazon AWS Elastic Bean',
          color: 'green'
        });

        yield _this2.logo(); // builds the app

        build.try_build = yield _this2.base_build();

        if (build.try_build.length > 0) {
          _this2.context.x_console.outT({
            message: "There was an error building the project.",
            color: 'red'
          });

          return false;
        } // deploys to aws


        build.deploy_aws_eb = yield _this2.run(); //test if results.length>0 (meaning there was an error)

        if (build.deploy_aws_eb.length > 0) {
          _this2.context.x_console.outT({
            message: "There was an error deploying to Amazon AWS.",
            color: 'red',
            data: build.deploy_aws_eb.toString()
          });

          return false;
        }

        return true;
      })();
    }

    _createEBx_configEB() {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        // create config.yml content for defining EB instance
        var eb_full = _this3.context.x_state.central_config.deploy.replaceAll('eb:', '');

        var eb_appname = eb_full;
        var eb_instance = "".concat(eb_appname, "-dev");

        if (eb_full.includes(',')) {
          eb_appname = eb_full.split(',')[0];
          eb_instance = eb_full.split(',').splice(-1)[0];
        } // create YAML


        var yaml = require('yaml');

        var data = {
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

        if (_this3.context.x_state.config_node.aws.region) {
          data.global.default_region = _this3.context.x_state.config_node.aws.region;
        } //write


        var path = require('path');

        var eb_base = _this3.context.x_state.dirs.app;
        var eb_dir = path.join(eb_base, '.elasticbeanstalk');
        yield _this3.context.writeFile(path.join(eb_dir, 'config.yml'), yaml.stringify(data, {
          version: '1.1'
        }));
      })();
    }

    _createEBx_configNode() {
      var _this4 = this;

      return _asyncToGenerator(function* () {
        // create 01_confignode content for setting ENV vars within EB instance
        var yaml = require('yaml');

        var data = {
          option_settings: {
            'aws:elasticbeanstalk:application:environment': {
              APP_PORT: _this4.context.x_state.central_config.port,
              CLUSTER: 1,
              START_TYPE: 'production'
            }
          }
        }; //instancetype

        if (_this4.context.x_state.central_config.instance_type) {
          data.option_settings.container_commands = {
            'aws:autoscaling:launchconfiguration': {
              InstanceType: _this4.context.x_state.central_config.instance_type
            }
          };
        } //port


        if (_this4.context.x_state.central_config.port != 8081) {
          data.container_commands = {
            '00_remove_redirect_http': {
              command: 'sudo iptables -t nat -D PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 8080'
            },
            '01_add_redirect_http': {
              command: "sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port ".concat(_this4.context.x_state.central_config.port)
            }
          };
          data.option_settings['aws:elasticbeanstalk:environment'] = {
            EnvironmentType: 'SingleInstance'
          };
        } //stage & env_variables


        if (_this4.context.x_state.central_config.stage && _this4.context.x_state.central_config.stage != '') {
          data.option_settings['aws:elasticbeanstalk:application:environment'].STAGE = _this4.context.x_state.central_config.stage;

          if (_this4.context.x_state.central_config.stage != 'dev') {
            data.option_settings['aws:elasticbeanstalk:application:environment'].START_TYPE = _this4.context.x_state.central_config.stage;
          }
        }

        var _loop = function _loop(key) {
          // omit special config 'reserved' (aurora,vpc,aws) node keys
          if (!['copiar'].includes(key) && typeof _this4.context.x_state.config_node[key] === 'object') {
            Object.keys(_this4.context.x_state.config_node[key]).map(function (attr) {
              if (attr.charAt(0) != ':') data.option_settings['aws:elasticbeanstalk:application:environment'][key.toUpperCase() + '_' + attr.toUpperCase()] = this.context.x_state.config_node[key][attr];
            }.bind(_this4));
          }
        };

        for (var key in _this4.context.x_state.config_node) {
          _loop(key);
        } //write


        var path = require('path');

        var eb_base = _this4.context.x_state.dirs.app;
        var eb_dir = path.join(eb_base, '.ebextensions');
        yield _this4.context.writeFile(path.join(eb_dir, '01_confignode.config'), yaml.stringify(data, {
          version: '1.1'
        }));
      })();
    }

    _createEBx_timeout() {
      var _this5 = this;

      return _asyncToGenerator(function* () {
        // create 01_confignode content for setting ENV vars within EB instance
        if (_this5.context.x_state.central_config.timeout) {
          var yaml = require('yaml');

          var data = {
            container_commands: {
              extend_proxy_timeout: {
                command: "sed -i '/\\s*location \\/ {/c \\\n        client_max_body_size 500M; \\\n        location / { \\\n                proxy_connect_timeout       ".concat(_this5.context.x_state.central_config.timeout, ";\\\n                proxy_send_timeout          ").concat(_this5.context.x_state.central_config.timeout, ";\\\n                proxy_read_timeout          ").concat(_this5.context.x_state.central_config.timeout, ";\\\n                send_timeout                ").concat(_this5.context.x_state.central_config.timeout, ";\\\n        ' /tmp/deployment/config/#etc#nginx#conf.d#00_elastic_beanstalk_proxy.conf")
              }
            }
          }; //write

          var path = require('path');

          var eb_base = _this5.context.x_state.dirs.app;
          var eb_dir = path.join(eb_base, '.ebextensions');
          yield _this5.context.writeFile(path.join(eb_dir, 'extend-proxy-timeout.config'), yaml.stringify(data)); //, { version:'1.1' }
        }
      })();
    }

    _createEBx_sockets() {
      var _this6 = this;

      return _asyncToGenerator(function* () {
        // create enable-websockets.config
        var yaml = require('yaml');

        var data = {
          container_commands: {
            enable_websockets: {
              command: "sed -i '/s*proxy_set_headers*Connection/c         proxy_set_header Upgrade $http_upgrade;        proxy_set_header Connection \"\"upgrade\"\";        ' /tmp/deployment/config/#etc#nginx#conf.d#00_elastic_beanstalk_proxy.conf"
            }
          }
        }; //write

        var path = require('path');

        var eb_base = _this6.context.x_state.dirs.app;
        var eb_dir = path.join(eb_base, '.ebextensions');
        yield _this6.context.writeFile(path.join(eb_dir, 'enable-websockets.config'), yaml.stringify(data, {
          version: '1.1'
        }));
      })();
    }

    _createEBx_puppeteer() {
      var _this7 = this;

      return _asyncToGenerator(function* () {
        // create puppeteer.config (chromium support)
        var yaml = require('yaml');

        var data = {
          container_commands: {
            install_chrome: {
              command: 'curl https://intoli.com/install-google-chrome.sh | bash'
            }
          }
        }; //write

        var path = require('path');

        var eb_base = _this7.context.x_state.dirs.app;
        var eb_dir = path.join(eb_base, '.ebextensions');
        yield _this7.context.writeFile(path.join(eb_dir, 'puppeteer.config'), yaml.stringify(data, {
          version: '1.1'
        }));
      })();
    }

    run() {
      var _this8 = this;

      return _asyncToGenerator(function* () {
        var spawn = require('await-spawn');

        var errors = []; //AWS EB deploy

        _this8.context.debug('AWS EB deploy');

        var eb_full = _this8.context.x_state.central_config.deploy.replaceAll('eb:', '');

        var eb_appname = eb_full;
        var eb_instance = "".concat(eb_appname, "-dev");

        if (eb_full.includes(',')) {
          eb_appname = eb_full.split(',')[0];
          eb_instance = eb_full.split(',').splice(-1)[0];
        }

        if (eb_appname != '') {
          var spinner = _this8.context.x_console.spinner({
            message: 'Creating config files'
          }); //this.x_console.outT({ message:`Creating EB config yml: ${eb_appname} in ${eb_instance}`, color:'yellow' });
          //create .ebextensions directory


          var path = require('path'),
              fs = require('fs').promises;

          var eb_base = _this8.context.x_state.dirs.app;
          var eb_dir_ext = path.join(eb_base, '.ebextensions');

          try {
            yield fs.mkdir(eb_dir_ext, {
              recursive: true
            });
          } catch (ef) {}

          var eb_dir = path.join(eb_base, '.elasticbeanstalk');

          try {
            yield fs.mkdir(eb_dir, {
              recursive: true
            });
          } catch (ef) {} //write .npmrc file


          yield _this8.context.writeFile(path.join(eb_base, '.npmrc'), 'unsafe-perm=true'); //write .ebextensions/config.yml

          yield _this8._createEBx_configEB(); //write .ebextensions/01_confignode.config

          yield _this8._createEBx_configNode(); //write .ebextensions/extend-proxy-timeout.config

          yield _this8._createEBx_timeout(); //enable websockets?

          if (_this8.context.x_state.central_config.rtc == true) {
            yield _this8._createEBx_sockets();
          }

          if (_this8.context.x_state.npm.puppeteer || _this8.context.x_state.npm['puppeteer-code']) {
            yield _this8._createEBx_puppeteer();
          } //create .ebignore file


          var eb_ig = "node_modules/\njspm_packages/\n.npm\n.node_repl_history\n*.tgz\n.yarn-integrity\n.editorconfig\n# Mac OSX\n.DS_Store\n# Elastic Beanstalk Files\n.elasticbeanstalk/*\n!.elasticbeanstalk/*.cfg.yml\n!.elasticbeanstalk/*.global.yml";
          yield _this8.context.writeFile(path.join(eb_base, '.ebignore'), eb_ig); //init git if not already

          spinner.succeed('EB config files created successfully');
          var results = {};
          var git_exists = yield _this8.context.exists(path.join(eb_base, '.git'));

          if (!git_exists) {
            //git directory doesn't exist
            //this.context.x_console.outT({ message:'CREATING .GIT DIRECTORY' });
            spinner.start('Initializing project git repository');
            spinner.text('Creating .gitignore file');
            var git_ignore = "# Mac System files\n.DS_Store\n.DS_Store?\n__MACOSX/\nThumbs.db\n# EB files\nnode_modules/";
            yield _this8.context.writeFile(path.join(eb_base, '.gitignore'), git_ignore);
            spinner.succeed('.gitignore created');
            spinner.start('Initializing local git repository ..');

            try {
              results.git_init = yield spawn('git', ['init', '-q'], {
                cwd: eb_base
              });
              spinner.succeed('GIT initialized');
            } catch (gi) {
              results.git_init = gi;
              spinner.fail('GIT failed to initialize');
              errors.push(gi);
            }

            spinner.start('Adding files to local git ..');

            try {
              results.git_add = yield spawn('git', ['add', '.'], {
                cwd: eb_base
              });
              spinner.succeed('git added files successfully');
            } catch (gi) {
              results.git_add = gi;
              spinner.fail('git failed to add local files');
              errors.push(gi);
            }

            spinner.start('Creating first git commit ..');

            try {
              results.git_commit = yield spawn('git', ['commit', '-m', 'Inicial'], {
                cwd: eb_base
              });
              spinner.succeed('git created first commit successfully');
            } catch (gi) {
              results.git_commit = gi;
              spinner.fail('git failed to create first commit');
              errors.push(gi);
            }
          }

          spinner.start('Deploying to AWS ElasticBean .. please wait'); // execute eb deploy

          try {
            if (_this8.context.x_config.nodeploy && _this8.context.x_config.nodeploy == true) {
              spinner.succeed('EB ready to be deployed (nodeploy as requested)');

              _this8.context.x_console.outT({
                message: "Aborting final deployment as requested",
                color: 'brightRed'
              });
            } else {
              results.eb_deploy = yield spawn('eb', ['deploy', eb_instance], {
                cwd: eb_base
              }); //, stdio:'inherit'

              spinner.succeed('EB deployed successfully');
            }
          } catch (gi) {
            //test if eb failed because instance has not being created yet, if so create it
            results.eb_deploy = gi;
            spinner.warn('EB failed to deploy'); //this.x_console.outT({ message:gi.toString(), color:'red'});

            if (gi.code == 4) {
              // IAM credentials are invalid or instance hasn't being created (eb create is missing)
              spinner.start('Checking if AWS credentials are valid ..');

              try {
                results.eb_create = yield spawn('aws', ['sts', 'get-caller-identity'], {
                  cwd: eb_base
                }); //, stdio:'inherit'

                spinner.succeed('AWS credentials are ok');
              } catch (aws_cred) {
                spinner.fail('Current AWS credentials are invalid');
                errors.push(aws_cred);
              }

              if (errors.length == 0) {
                spinner.start('This looks like a new deployment: issuing eb create');

                try {
                  //console.log('eb create\n',['eb','create',eb_instance]);
                  yield _this8.launchTerminal('eb', ['create', eb_instance], eb_base);
                  yield _this8.sleep(1000);
                  spinner.succeed('EB created and deployed successfully'); //results.eb_create = await spawn('eb',['create',eb_instance],{ cwd:eb_base }); //, stdio:'inherit'
                  //console.log(results.eb_create);
                  //process.exit(6);
                } catch (ec) {
                  _this8.context.x_console.outT({
                    message: gi.stdout.toString(),
                    color: 'red'
                  });

                  spinner.fail('EB creation failed');
                  errors.push(gi);
                }
              }
            } else {
              _this8.context.x_console.outT({
                message: 'error: eb create (exitcode:' + gi.code + '):' + gi.toString(),
                color: 'red'
              });

              errors.push(gi);
            }
          } //if errors.length==0 && this.x_state.central_config.debug=='true'


          if (errors.length == 0 && _this8.context.x_state.central_config.debug == true && !_this8.context.x_config.nodeploy) {
            //open eb logging console
            var ci = require('ci-info');

            if (ci.isCI == false) {
              spinner.start('Opening EB debug terminal ..');

              try {
                var abs_cmd = path.resolve(eb_base);
                var cmd = "clear; sleep 2; clear; cd ".concat(abs_cmd, " && clear && eb open ").concat(eb_instance);
                results.eb_log = yield spawn('npx', ['terminal-tab', cmd], {
                  cwd: abs_cmd
                }); //, detached:true

                spinner.succeed("EB logging opened on new tab successfully");
              } catch (ot) {
                results.eb_log = ot;
                spinner.fail("I was unable to open a new tab terminal window with the EB debugging console");
              }
            } else {
              spinner.warn("Omitting EB debug, because a CI env was detected.");
            }
          } // eb deploy done

        }

        return errors;
      })();
    } //****************************
    // onPrepare and onEnd steps
    //****************************


    post() {
      var _this9 = this;

      return _asyncToGenerator(function* () {
        var ci = require('ci-info'); //restores aws credentials if modified by onPrepare after deployment


        if (!_this9.context.x_state.central_config.componente && _this9.context.x_state.central_config.deploy && _this9.context.x_state.central_config.deploy.indexOf('eb:') != -1 && _this9.context.x_state.config_node.aws && ci.isCI == false) {
          // @TODO add this block to deploys/eb 'post' method and onPrepare to 'pre' 20-br-21
          // only execute after deploy and if user requested specific aws credentials on map
          var path = require('path'),
              copy = require('recursive-copy'),
              os = require('os');

          var aws_bak = path.join(_this9.context.x_state.dirs.base, 'aws_backup.ini');
          var aws_file = path.join(os.homedir(), '/.aws/') + 'credentials'; // try to copy aws_bak over aws_ini_file (if bak exists)

          var fs = require('fs');

          if (yield _this9.context.exists(aws_bak)) {
            yield copy(aws_bak, aws_file, {
              overwrite: true,
              dot: true,
              debug: false
            }); // remove aws_bak file

            yield fs.promises.unlink(aws_bak);
          }
        }
      })();
    }

    pre() {
      var _this10 = this;

      return _asyncToGenerator(function* () {
        var ci = require('ci-info');

        if (!_this10.context.x_state.central_config.componente && _this10.context.x_state.central_config.deploy && _this10.context.x_state.central_config.deploy.indexOf('eb:') != -1 && ci.isCI == false) {
          // if deploying to AWS eb:x, then recover/backup AWS credentials from local system
          var ini = require('ini'),
              path = require('path'),
              fs = require('fs').promises; // read existing AWS credentials if they exist


          var os = require('os');

          var aws_ini = '';
          var aws_folder = path.join(os.homedir(), '/.aws/');
          var aws_ini_file = path.join(aws_folder, 'credentials');

          try {
            //this.debug('trying to read AWS credentials:',aws_ini_file);
            aws_ini = yield fs.readFile(aws_ini_file, 'utf-8'); //this.context.debug('AWS credentials:',aws_ini);
          } catch (err_reading) {} // 


          if (_this10.context.x_state.config_node.aws) {
            // if DSL defines temporal AWS credentials for this app .. 
            // create backup of aws credentials, if existing previously
            if (aws_ini != '') {
              var aws_bak = path.join(_this10.context.x_state.dirs.base, 'aws_backup.ini');

              _this10.context.x_console.outT({
                message: "config:aws:creating .aws/credentials backup",
                color: 'yellow'
              });

              yield fs.writeFile(aws_bak, aws_ini, 'utf-8');
            } // debug


            _this10.context.x_console.outT({
              message: "config:aws:access ->".concat(_this10.context.x_state.config_node.aws.access)
            });

            _this10.context.x_console.outT({
              message: "config:aws:secret ->".concat(_this10.context.x_state.config_node.aws.secret)
            }); // transform config_node.aws keys into ini


            var to_ini = ini.stringify({
              aws_access_key_id: _this10.context.x_state.config_node.aws.access,
              aws_secret_access_key: _this10.context.x_state.config_node.aws.secret
            }, {
              section: 'default'
            });

            _this10.context.debug('Setting .aws/credentials from config node'); // save as .aws/credentials (ini file)


            try {
              yield fs.writeFile(aws_ini_file, to_ini, 'utf-8');
            } catch (errdir) {
              //if fails, maybe target dir doesn't exist
              try {
                yield fs.mkdir(aws_folder, {
                  recursive: true
                });
              } catch (errdir2) {}
            }
          } else if (aws_ini != '') {
            // if DSL doesnt define AWS credentials, use the ones defined within the local system.
            var parsed = ini.parse(aws_ini);
            if (parsed.default) _this10.context.debug('Using local system AWS credentials', parsed.default);
            _this10.context.x_state.config_node.aws = {
              access: '',
              secret: ''
            };
            if (parsed.default.aws_access_key_id) _this10.context.x_state.config_node.aws.access = parsed.default.aws_access_key_id;
            if (parsed.default.aws_secret_access_key) _this10.context.x_state.config_node.aws.secret = parsed.default.aws_secret_access_key;
          }
        }
      })();
    } // config hooks


    setEnvs(envs) {
      return _asyncToGenerator(function* () {
        return [...envs, 'START_TYPE=production'];
      })();
    }

    codeForModel(model) {
      var _this11 = this;

      return _asyncToGenerator(function* () {
        //express = {models,routes}
        //returns array with records of lines of code
        var resp = []; //aws config requirements

        if (_this11.context.x_state.npm['aws-sdk']) {
          if (!_this11.context.x_state.config_node.aws) {
            _this11.context.x_state.npm['aws-get-credentials'] = '*';
            resp.push("const AWS = require('aws-sdk');\n                (async function() {\n                    const { getAWSCredentials } = require('aws-get-credentials');\n                    AWS.config.credentials = await getAWSCredentials();;\n                })();\n                const AWS_s3 = new AWS.S3();");
          } else {
            var aws_data = {
              accessKeyId: _this11.context.x_state.config_node.aws.access,
              secretAccessKey: _this11.context.x_state.config_node.aws.secret
            };

            if (_this11.context.x_state.config_node.aws.region) {
              aws_data.region = _this11.context.x_state.config_node.aws.region;
            }

            resp.push("const AWS = require('aws-sdk');\n                AWS.config.update(".concat(_this11.context.jsDump(aws_data), ");\n                const AWS_s3 = new AWS.S3();"));
          }
        }

        return resp;
      })();
    }

  }

  function dedent(strings) {

    var raw = void 0;
    if (typeof strings === "string") {
      // dedent can be used as a plain function
      raw = [strings];
    } else {
      raw = strings.raw;
    }

    // first, perform interpolation
    var result = "";
    for (var i = 0; i < raw.length; i++) {
      result += raw[i].
      // join lines when there is a suppressed newline
      replace(/\\\n[ \t]*/g, "").

      // handle escaped backticks
      replace(/\\`/g, "`");

      if (i < (arguments.length <= 1 ? 0 : arguments.length - 1)) {
        result += arguments.length <= i + 1 ? undefined : arguments[i + 1];
      }
    }

    // now strip indentation
    var lines = result.split("\n");
    var mindent = null;
    lines.forEach(function (l) {
      var m = l.match(/^(\s+)\S+/);
      if (m) {
        var indent = m[1].length;
        if (!mindent) {
          // this is the first indented line
          mindent = indent;
        } else {
          mindent = Math.min(mindent, indent);
        }
      }
    });

    if (mindent !== null) {
      result = lines.map(function (l) {
        return l[0] === " " ? l.slice(mindent) : l;
      }).join("\n");
    }

    // dedent eats leading and trailing whitespace too
    result = result.trim();

    // handle escaped newlines at the end to ensure they don't get stripped too
    return result.replace(/\\n/g, "\n");
  }

  if (typeof module !== "undefined") {
    module.exports = dedent;
  }

  var concepto = require('@concepto/interface'); //import { timingSafeEqual } from 'crypto';
  class fastify_dsl extends concepto {
    constructor(file) {
      var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      // we can get class name, from package.json name key (after its in its own project)
      var my_config = {
        class: 'fastify',
        debug: true
      };

      var nuevo_config = _objectSpread2(_objectSpread2({}, my_config), config);

      super(file, nuevo_config); //,...my_config
      // custom dsl_git version

      this.x_config.dsl_git = /*#__PURE__*/function () {
        var _ref = _asyncToGenerator(function* (content) {
          //save git version
          var tmp = {},
              fs = require('fs').promises,
              path = require('path'); //SECRETS


          this.x_state.config_node = yield this._readConfig(false);

          if (this.x_flags.dsl.includes('_git.dsl')) {
            // if file is x_git.dsl, expand secrets
            this.x_console.outT({
              message: 'we are the git!',
              color: 'green'
            });
            this.x_state.config_node = yield this._restoreSecrets(this.x_state.config_node);
            delete this.x_state.config_node[':id'];
            delete this.x_state.config_node[':secrets'];
            delete this.x_state.config_node['::secrets']; //search and erase config->:secrets node
            //this.x_console.out({ message:'config read on git',data:this.x_state.config_node });
          } else {
            // if file is x.dsl,
            // write x_git.dsl
            tmp.dsl_path = path.dirname(path.resolve(this.x_flags.dsl));
            tmp.dsl_git = path.join(tmp.dsl_path, path.basename(this.x_flags.dsl).replace('.dsl', '_git.dsl'));
            yield fs.writeFile(tmp.dsl_git, content, 'utf-8');
            this.debug("custom dsl_git file saved as: ".concat(tmp.dsl_git)); // export secret keys as :secrets node to eb_git.dsl

            yield this._secretsToGIT(this.x_state.config_node);
          } //

        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      }().bind(this);
    } // SECRETS helpers


    _secretsToGIT(resp) {
      var _this = this;

      return _asyncToGenerator(function* () {
        var path = require('path'),
            fs = require('fs').promises;

        var encrypt = require('encrypt-with-password');

        var curr_dsl = path.basename(_this.x_flags.dsl); // secret nodes to _git.dsl file

        if (resp['::secrets'] && resp['::secrets'].length > 0 && !curr_dsl.includes('_git.')) {
          //encrypt existing secret (password) nodes and save them as config->:secrets within _git.dsl file version
          var password = '';
          if (_this.x_config.secrets_pass && _this.x_config.secrets_pass != '') password = _this.x_config.secrets_pass.trim();

          if (password == '') {
            //if a password was not given, invent a memorable one
            var gpass = require('password-generator');

            password = gpass();
            resp[':password'] = password; //inform a pass was created
          } //encrypt secrets object


          var to_secrets = encrypt.encryptJSON(resp['::secrets'], password); //create :secrets node within eb_git.dsl file

          var dsl_parser = require('@concepto/dsl_parser');

          var dsl = new dsl_parser({
            file: _this.x_flags.dsl.replace('.dsl', '_git.dsl'),
            config: {
              cancelled: true,
              debug: false
            }
          });

          try {
            yield dsl.process();
          } catch (d_err) {
            _this.x_console.out({
              message: "error: file ".concat(_this.x_flags.dsl.replace('.dsl', '_git.dsl'), " does't exist!"),
              data: d_err
            });

            return;
          }

          var new_content = yield dsl.addNode({
            parent_id: resp[':id'],
            node: {
              text: ':secrets',
              icons: ['password'],
              text_note: to_secrets
            }
          });
          var tmp = {};
          tmp.dsl_git_path = path.dirname(path.resolve(_this.x_flags.dsl));
          var git_target = path.join(tmp.dsl_git_path, path.basename(_this.x_flags.dsl).replace('.dsl', '_git.dsl')); //,path.basename(this.x_flags.dsl)

          yield fs.writeFile(git_target, new_content, 'utf-8');

          _this.debug("dsl_git file saved as: ".concat(git_target));

          if (resp[':password']) {
            _this.x_console.outT({
              message: "Password generated for DSL GIT secrets ->".concat(password),
              color: 'brightGreen'
            });
          } //

        }

        return resp;
      })();
    } // restore :secrets node info if it exists and a password was given


    _restoreSecrets(resp) {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        var path = require('path'),
            fs = require('fs').promises;

        var encrypt = require('encrypt-with-password');

        var curr_dsl = path.basename(_this2.x_flags.dsl);

        if (curr_dsl.includes('_git.') && resp[':secrets']) {
          _this2.x_console.outT({
            message: "Secrets node detected!",
            color: 'brightCyan'
          });

          if (_this2.x_config.secrets_pass && _this2.x_config.secrets_pass != '') {
            _this2.x_console.outT({
              message: 'Decrypting config->secrets',
              color: 'brightGreen'
            });

            try {
              var from_secrets = encrypt.decryptJSON(resp[':secrets'], _this2.x_config.secrets_pass); // read nodes into resp struct

              for (var xs of from_secrets) {
                resp = _objectSpread2(_objectSpread2({}, resp), _this2.configFromNode(resp, xs));
              }

              var tmp = {};
              tmp.dsl_git_path = path.dirname(path.resolve(_this2.x_flags.dsl));
              tmp.non_target = path.join(tmp.dsl_git_path, path.basename(_this2.x_flags.dsl).replace('_git.dsl', '.dsl'));
              tmp.exists_non = yield _this2.exists(tmp.non_target);

              if (true) {
                //!tmp.exists_non - always overwrite x.dsl
                _this2.x_console.outT({
                  message: 'Expanding secrets into ' + curr_dsl.replace('_git.dsl', '.dsl'),
                  color: 'cyan'
                }); // expand secret nodes into non _git.dsl version config key


                var dsl_parser = require('@concepto/dsl_parser');

                var dsl = new dsl_parser({
                  file: _this2.x_flags.dsl,
                  config: {
                    cancelled: true,
                    debug: false
                  }
                });

                try {
                  yield dsl.process();
                } catch (d_err) {
                  _this2.x_console.out({
                    message: "error: file ".concat(_this2.x_flags.dsl, " does't exist!"),
                    data: d_err
                  });

                  return;
                } // remove config->:secrets node if it exists


                var $ = dsl.getParser();
                var search = $("node[TEXT=config] node[TEXT=:secrets]").toArray();
                search.map(function (elem) {
                  $(elem).remove();
                }); //

                var new_content = '';

                for (var sn of from_secrets) {
                  new_content = yield dsl.addNode({
                    parent_id: resp[':id'],
                    node: sn
                  });
                } // save expanded x.dsl file (only if it doesnt exist)


                yield fs.writeFile(tmp.non_target, new_content, 'utf-8');

                _this2.debug("recovered dsl file saved as: ".concat(tmp.non_target));
              } //

            } catch (invpass) {
              //console.log(invpass);
              _this2.x_console.outT({
                message: 'Invalid --secret-pass value for map (check your password)',
                color: 'brightRed'
              });

              _this2.x_console.outT({
                message: 'WARNING: The process may fail if keys are needed',
                color: 'red'
              });
            }
          } else {
            _this2.x_console.outT({
              message: 'WARNING: file contains secrets, but no --secrets-pass arg was given',
              color: 'brightRed'
            });

            _this2.x_console.outT({
              message: 'WARNING: The process may fail if keys are needed',
              color: 'red'
            });
          }
        }

        return resp;
      })();
    } //
    // **************************
    // methods to be auto-called
    // **************************
    //Called after init method finishes


    onInit() {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        if (Object.keys(_this3.x_commands).length > 0) _this3.x_console.outT({
          message: "".concat(Object.keys(_this3.x_commands).length, " local x_commands loaded!"),
          color: "green"
        }); // init
        // set x_state defaults

        _this3.x_state = _objectSpread2(_objectSpread2({}, _this3.x_state), {
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
          stores_types: {
            versions: {},
            expires: {}
          },
          nuxt_config: {
            head_script: {},
            build_modules: {},
            modules: {}
          }
        });

        var ci = require('ci-info');

        _this3.isCI = ci.isCI;
        if (!_this3.x_state.config_node) _this3.x_state.config_node = yield _this3._readConfig(); //this.debug('config_node',this.x_state.config_node);

        _this3.x_state.central_config = yield _this3._readCentralConfig(); //if requested silence...

        if (_this3.x_config.silent) {
          _this3.x_console.outT({
            message: "silent mode requested",
            color: "dim"
          }); //this.x_console.setSilent(true);


          _this3.x_config.debug = false;
        } //this.debug('central_config',this.x_state.central_config);
        //this.x_state.assets = await this._readAssets();
        //this.debug('assets_node',this.x_state.assets);


        if (_this3.x_config.deploy && _this3.x_config.deploy.trim() != '') {
          _this3.x_console.outT({
            message: "(as requested) force changing deploy target to: ".concat(_this3.x_config.deploy.trim()),
            color: "brightYellow"
          });

          _this3.x_state.central_config.deploy = _this3.x_config.deploy;
        }

        var _folders = {
          'bin': 'bin/',
          'models': 'models/',
          'routes': 'routes/',
          'views': 'views/',
          'db_models': 'prisma/',
          'public': 'public/',
          'doc': 'doc/'
        };

        if (_this3.x_state.central_config.deploy && _this3.x_state.central_config.deploy.includes('sls:')) {
          _folders.secrets = 'secrets/';
        }

        _this3.x_state.dirs = yield _this3._appFolders(_folders); // read modelos node (Prisma DB)

        _this3.x_state.models = yield _this3._readModelos(); //alias: database tables

        console.log('PABLO debug models', _this3.x_state.models); //is local server running? if so, don't re-launch it

        _this3.x_state.fastify_is_running = yield _this3._isLocalServerRunning();

        _this3.debug('is Server Running: ' + _this3.x_state.fastify_is_running); // init terminal diagnostics


        if (_this3.atLeastNode('10') == false) {
          //this.debug('error: You need at least Node v10+ to use latest version!');
          throw new Error('You need to have at least Node v10+ to run these instances!');
        }

        _this3.x_state.es6 = true; // copy sub-directories if defined in node 'config.copiar' key

        if (_this3.x_state.config_node.copiar) {
          var _path = require('path');

          var copy = require('recursive-copy');

          _this3.x_console.outT({
            message: "copying config:copiar directories to 'root' target folder",
            color: "yellow"
          });

          yield Object.keys(_this3.x_state.config_node.copiar).map( /*#__PURE__*/function () {
            var _ref2 = _asyncToGenerator(function* (key) {
              var abs = _path.join(this.x_state.dirs.base, key);

              try {
                yield copy(abs, _path.join(this.x_state.dirs.app, key));
              } catch (err_copy) {
                if (err_copy.code != 'EEXIST') this.x_console.outT({
                  message: "error: copying directory ".concat(abs),
                  data: err_copy
                });
              } //console.log('copying ',{ from:abs, to:this.x_state.dirs.static });

            });

            return function (_x2) {
              return _ref2.apply(this, arguments);
            };
          }().bind(_this3));

          _this3.x_console.outT({
            message: "copying config:copiar directories ... READY",
            color: "yellow"
          });
        } // *********************************************
        // install requested modules within config node
        // *********************************************


        _this3.x_console.outT({
          message: "fastify initialized() ->"
        }); // JSDoc


        _this3.x_state.dev_npm['jsdoc'] = '*';
        _this3.x_state.dev_npm['jsdoc-i18n-plugin'] = '*';
        _this3.x_state.dev_npm['@pixi/jsdoc-template'] = '*'; // add fastify support

        _this3.x_state.npm['@fastify/autoload'] = '^5.0.0';
        _this3.x_state.npm['@fastify/sensible'] = '^5.0.0';
        _this3.x_state.npm['@fastify/static'] = '6.6.1';
        _this3.x_state.npm['@fastify/view'] = '^7.4.0';
        _this3.x_state.npm['fastify'] = '^4.0.0';
        _this3.x_state.npm['fastify-cli'] = '^5.7.1';
        _this3.x_state.npm['fastify-plugin'] = '^4.0.0';
        _this3.x_state.dev_npm['fastify-prisma-client'] = '^5.0.0';
        _this3.x_state.dev_npm['prisma'] = '^4.8.1';
        _this3.x_state.dev_npm['tap'] = '^16.1.0'; // undescore & other lib support

        _this3.x_state.dev_npm['lodash'] = '^4.17.11';
        _this3.x_state.npm['underscore'] = '*';
        _this3.x_state.npm['axios'] = '*';
        _this3.x_state.npm['file-type'] = '*';
        _this3.x_state.npm['moment'] = '*';
        _this3.x_state.npm['moment-timezone'] = '*'; // additional required dependencies

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

        if (_this3.x_state.config_node.favicon) {
          // copy icon to static dir
          var _path2 = require('path');

          var source = _path2.join(_this3.x_state.dirs.base, _this3.x_state.config_node.favicon);

          var target = _this3.x_state.dirs.app + 'icon.png';

          _this3.debug({
            message: "ICON dump (copy icon)",
            color: "yellow",
            data: source
          });

          var fs = require('fs').promises;

          try {
            yield fs.copyFile(source, target);
          } catch (err_fs) {
            _this3.x_console.outT({
              message: "error: copying fastify icon",
              data: err_fs
            });
          }
        } // serialize 'secret' config keys as json files in app secrets sub-directory (if any)
        // extract 'secret's from config keys; 

        /* */


        _this3.debug('serializing secrets');

        _this3.x_state.secrets = {}; //await _extractSecrets(config_node)

        var path = require('path');

        for (var key in _this3.x_state.config_node) {
          if (typeof key === 'string' && key.includes(':') == false) {
            if (_this3.x_state.config_node[key][':secret']) {
              var new_obj = _objectSpread2({}, _this3.x_state.config_node[key]);

              delete new_obj[':secret'];
              if (new_obj[':link']) delete new_obj[':link']; // set object keys to uppercase

              _this3.x_state.secrets[key] = {};
              var obj_keys = Object.keys(new_obj);

              for (var x in obj_keys) {
                _this3.x_state.secrets[key][x.toUpperCase()] = new_obj[x];
              }

              if (_this3.x_state.dirs.secrets) {
                var _target = path.join(_this3.x_state.dirs.secrets, "".concat(key, ".json"));

                yield _this3.writeFile(_target, JSON.stringify(new_obj));
              }
            }
          }
        }

        _this3.debug('setting ENV variables'); // set config keys as ENV accesible variables (ex. $config.childnode.attributename)


        var _loop = function _loop(_key) {
          // omit special config 'reserved' (aurora,vpc,aws) node keys
          if (!['vpc', 'aws', 'copiar'].includes(_key) && typeof _this3.x_state.config_node[_key] === 'object') {
            Object.keys(_this3.x_state.config_node[_key]).map(function (attr) {
              this.x_state.envs["config.".concat(_key, ".").concat(attr)] = "process.env.".concat((_key + '_' + attr).toUpperCase());
            }.bind(_this3));
          }
        };

        for (var _key in _this3.x_state.config_node) {
          _loop(_key);
        } // show this.x_state contents
        //this.debug('x_state says',this.x_state);

      })();
    } //Called after parsing nodes


    onAfterProcess(processedNode) {
      return _asyncToGenerator(function* () {
        return processedNode;
      })();
    } //Called for defining the title of class/page by testing node.


    onDefineTitle(node) {
      var _this4 = this;

      return _asyncToGenerator(function* () {
        var resp = node.text;
        Object.keys(node.attributes).map(function (i) {
          if (i == 'title' || i == 'titulo') {
            resp = node.attributes[i];
            return false;
          }
        }.bind(_this4));
        /*
        for (i in node.attributes) {
        	if (['title','titulo'].includes(node.attributes[i])) {
        		resp = node.attributes[i];
        		break;
        	}
        }*/

        return resp;
      })();
    } //Called for naming filename of class/page by testing node.


    onDefineFilename(node) {
      return _asyncToGenerator(function* () {
        return node.text;
      })();
    } //Called for naming the class/page by testing node.


    onDefineNodeName(node) {
      return _asyncToGenerator(function* () {
        return node.text.replace(' ', '_');
      })();
    } //Defines template for code given the processedNode of process() - for each level2 node


    onCompleteCodeTemplate(processedNode) {
      return _asyncToGenerator(function* () {
        return processedNode;
      })();
    } //Defines preparation steps before processing nodes.


    onPrepare() {
      var _this5 = this;

      return _asyncToGenerator(function* () {
        if (Object.keys(_this5.x_commands).length > 0) _this5.x_console.outT({
          message: "".concat(Object.keys(_this5.x_commands).length, " x_commands loaded!"),
          color: "green"
        });
        _this5.deploy_module = {
          pre: () => {},
          post: () => {},
          deploy: () => true
        };
        var deploy = _this5.x_state.central_config.deploy;

        if (deploy) {
          deploy += '';

          if (deploy.includes('eb:')) {
            _this5.deploy_module = new eb({
              context: _this5
            });
          } else if (deploy == 'local') {
            _this5.deploy_module = new local({
              context: _this5
            }); //
          } else ;
        }

        yield _this5.deploy_module.pre();
      })();
    } //Executed when compiler founds an error processing nodes.


    onErrors(errors) {
      var _this6 = this;

      return _asyncToGenerator(function* () {
        _this6.errors_found = true;
      })();
    } //.gitignore helper


    createGitIgnore() {
      var _this7 = this;

      return _asyncToGenerator(function* () {
        _this7.debug('writing .gitignore files');

        var fs = require('fs').promises;

        _this7.debug({
          message: 'writing dsl /.gitignore file'
        });

        var git = "# Mac System files\n.DS_Store\n.DS_Store?\n_MACOSX/\nThumbs.db\n# Logs\nlogs\n*.log\nnpm-debug.log*\n\n# Runtime data\npids\n*.pid\n*.seed\n\n# Directory for instrumented libs generated by jscoverage/JSCover\nlib-cov\n\n# Coverage directory used by tools like istanbul\ncoverage\n\n# nyc test coverage\n.nyc_output\n\n# Grunt intermediate storage (http://gruntjs.com/creating-plugins#storing-task-files)\n.grunt\n\n# node-waf configuration\n.lock-wscript\n\n# Compiled binary addons (http://nodejs.org/api/addons.html)\nbuild/Release\n\n# Dependency directories\nnode_modules\njspm_packages\n\n# Optional npm cache directory\n.npm\n\n# Optional REPL history\n.node_repl_history\n\n# 0x\nprofile-*\n\n# mac files\n.DS_Store\n\n# vim swap files\n*.swp\n\n# webstorm\n.idea\n\n# vscode\n.vscode\n*code-workspace\n\n# clinic\nprofile*\n*clinic*\n*flamegraph*\n".concat(_this7.x_state.dirs.compile_folder, "/");
        yield fs.writeFile("".concat(_this7.x_state.dirs.base, ".gitignore"), git, 'utf-8'); //.gitignore
      })();
    } // create /README.md file


    createReadme() {
      var _this8 = this;

      return _asyncToGenerator(function* () {
        var fs = require('fs').promises;

        if (_this8.x_state.central_config.readme != '') {
          yield* function* () {
            var set_envs = [];

            var _loop2 = function _loop2(key) {
              if (!['vpc', 'aws', 'copiar'].includes(key) && typeof _this8.x_state.config_node[key] === 'object') {
                Object.keys(_this8.x_state.config_node[key]).map(function (attr) {
                  if (key.charAt(0) != ':' && attr.charAt(0) != ':') {
                    set_envs.push("".concat(key.toUpperCase(), "_").concat(attr.toUpperCase()));
                  }
                }.bind(_this8));
              }
            };

            for (var key in _this8.x_state.config_node) {
              _loop2(key);
            }

            var content = "<b>".concat(_this8.x_state.central_config.readme, "</b><br/><br/>\n            APP_PORT (int)<br/>\n            CLUSTER (int)<br/>");

            if (set_envs.length > 0) {
              content += "Esta aplicacion requiere configurar las siguientes variables de entorno en la instancia de ElasticBean:<br/><br/>";
              content += set_envs.join('<br/>') + '\n';
            }

            yield fs.writeFile("".concat(_this8.x_state.dirs.app, "README.md"), content, 'utf-8');
          }();
        }
      })();
    }

    createErrorTemplate() {
      var _this9 = this;

      return _asyncToGenerator(function* () {
        var fs = require('fs').promises;

        var content = "<h1><%= message %></h1>\n        <h2><%= error.status %></h2>\n        <pre><%= error.stack %></pre>";
        yield fs.writeFile("".concat(_this9.x_state.dirs.views, "error.ejs"), content, 'utf-8');
      })();
    }

    createJSDoc() {
      var _this10 = this;

      return _asyncToGenerator(function* () {
        // jsdoc.js file
        var data = {
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
        var content = JSON.stringify(data);
        yield _this10.writeFile("".concat(_this10.x_state.dirs.app, "jsdoc.json"), content);
      })();
    } //server launcher file (ex with cluster support etc)


    createBinFile() {
      var _this11 = this;

      return _asyncToGenerator(function* () {
        var content = "#!/usr/bin/env node\nconst app = require('../app');\nconst port = normalizePort(process.env.PORT || '8081');\nconst os = require('os');\nconst cluster = require('cluster');\nconst clusterWorkerSize = os.cpus().length;\nconst fastifyOptions = {\n    logger: false,\n    disableRequestLogging: true\n};\n\n// methods\nconst normalizePort = (val) => {\n\tvar port = parseInt(val, 10);\n\tif (isNaN(port)) {\n\t\treturn val;\n\t}\n\tif (port >= 0) {\n\t\treturn port;\n\t}\n\treturn false;\n}\n\n// Run the server with cluster support\nif (clusterWorkerSize > 1) {\n    if (cluster.isMaster) {\n        for (let i = 0; i < clusterWorkerSize; i += 1) {\n            cluster.fork();\n        }\n        cluster.on('exit', (worker)=>{\n            console.log(`Worker ${worker.id} has exited`);\n        })\n    } else {\n        app.start(port,fastifyOptions);\n    }\n} else {\n    app.start(port,fastifyOptions);\n}\n";
        yield _this11.writeFile("".concat(_this11.x_state.dirs.bin, "www"), content);
      })();
    }

    createPackageJSON() {
      var _this12 = this;

      return _asyncToGenerator(function* () {
        var cleanLinesDoc = function cleanLinesDoc(text) {
          //trim each line
          var resp = '',
              lines = text.split('\n');

          for (var line in lines) {
            var t_line = lines[line].trim();

            if (t_line != '') {
              //if (used!=0) resp += ' * ';
              resp += t_line + '\n';
            }
          }

          if (resp.slice(-1) == '\n') resp = resp.substr(0, resp.length - 1); //resp += ' * ';

          return resp;
        };

        var data = {
          name: _this12.x_state.central_config.service_name.toLowerCase(),
          description: cleanLinesDoc(_this12.x_state.central_config[':description']),
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
        if (_this12.x_state.central_config[':version'] != 'auto') data.version = _this12.x_state.central_config[':version'];
        if (_this12.x_state.central_config[':author']) data.author = _this12.x_state.central_config[':author'];
        if (_this12.x_state.central_config[':license']) data.license = _this12.x_state.central_config[':license'];

        if (_this12.x_state.central_config[':git']) {
          data.repository = {
            type: 'git',
            url: "git+".concat(_this12.x_state.central_config[':git'], ".git")
          };
          data.bugs = {
            url: "".concat(_this12.x_state.central_config[':git'], "/issues")
          };
          data.homepage = _this12.x_state.central_config[':git'];
        }

        if (_this12.x_state.central_config[':keywords']) data.keywords = _this12.x_state.central_config[':keywords'].split(','); // set port and env variables to script dev

        var set_envs = ["APP_PORT=".concat(_this12.x_state.central_config.port), "CLUSTER=1"];

        var _loop3 = function _loop3(key) {
          if (!['vpc', 'aws', 'copiar'].includes(key) && typeof _this12.x_state.config_node[key] === 'object') {
            Object.keys(_this12.x_state.config_node[key]).map(function (attr) {
              if (key.charAt(0) != ':' && attr.charAt(0) != ':') {
                set_envs.push("".concat(key.toUpperCase(), "_").concat(attr.toUpperCase(), "=").concat(this.x_state.config_node[key][attr]));
              }
            }.bind(_this12));
          }
        };

        for (var key in _this12.x_state.config_node) {
          _loop3(key);
        } // omit stage as start_type; it seems its not needed
        // call hook for deploy_module (if needs to add env variables depending on deploy)


        if (_this12.deploy_module.setEnvs) {
          set_envs = yield _this12.deploy_module.setEnvs(set_envs);
        } // add to package script _dev


        data.scripts.dev = set_envs.join(' ') + ' ' + data.scripts.dev; //
        //add dependencies

        for (var pack in _this12.x_state.npm) {
          if (_this12.x_state.npm[pack].includes('http') && _this12.x_state.npm[pack].includes('github.com')) {
            data.dependencies[pack] = "git+".concat(_this12.x_state.npm[pack]);
          } else {
            data.dependencies[pack] = _this12.x_state.npm[pack];
          }
        } //add devDependencies


        for (var _pack in _this12.x_state.dev_npm) {
          if (_this12.x_state.dev_npm[_pack].includes('http') && _this12.x_state.dev_npm[_pack].includes('github.com')) {
            data.devDependencies[_pack] = "git+".concat(_this12.x_state.dev_npm[_pack]);
          } else {
            data.devDependencies[_pack] = _this12.x_state.dev_npm[_pack];
          }
        } //write to disk


        var path = require('path');

        var target = path.join(_this12.x_state.dirs.app, "package.json");
        var content = JSON.stringify(data);
        yield _this12.writeFile(target, content); //this.x_console.outT({ message:'future package.json', data:data});
      })();
    }

    createVSCodeHelpers() {
      var _this13 = this;

      return _asyncToGenerator(function* () {
        // creates Visual Studio code common helpers
        var path = require('path'); // creates /jsconfig.json file for IntelliSense


        var data = {
          include: ['./client/**/*'],
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
          exclude: ['node_modules', 'secrets']
        }; //write to disk

        var target = path.join(_this13.x_state.dirs.app, "jsconfig.json");
        var content = JSON.stringify(data);
        yield _this13.writeFile(target, content);
      })();
    }

    createServerlessYML() {
      var _this14 = this;

      return _asyncToGenerator(function* () {
        var yaml = require('yaml'),
            data = {};

        var deploy = _this14.x_state.central_config.deploy + '';

        if (deploy.includes('eb:') == false && deploy != false && deploy != 'local') {
          data.service = _this14.x_state.central_config.service_name;
          data.custom = {
            prune: {
              automatic: true,
              includeLayers: true,
              number: 1
            },
            apigwBinary: {
              types: ['*/*']
            }
          }; //add 'secrets' config json keys - cfc:12895
          //this.x_state.secrets

          for (var secret in _this14.x_state.secrets) {
            data.custom[secret] = '${file(secrets/' + secret + '.json)}';
          } //domain info


          if (_this14.x_state.central_config.dominio) {
            data.custom.customDomain = {
              domainName: _this14.x_state.central_config.dominio
            };
            if (_this14.x_state.central_config.basepath) data.custom.customDomain.basePath = _this14.x_state.central_config.basepath;
            if (_this14.x_state.central_config.stage) data.custom.customDomain.stage = _this14.x_state.central_config.stage;
            data.custom.customDomain.createRoute53Record = true;
          } //nodejs env on aws


          data.provider = {
            name: 'aws',
            runtime: 'nodejs8.10',
            timeout: _this14.x_state.central_config.timeout
          };
          if (_this14.x_state.central_config.stage) data.provider.stage = _this14.x_state.central_config.stage; //env keys

          if (Object.keys(_this14.x_state.config_node) != '') {
            data.provider.enviroment = {};
            if (_this14.x_state.central_config.stage) data.provider.enviroment.STAGE = _this14.x_state.central_config.stage;

            if (_this14.x_state.config_node.vpc) {
              data.provider.vpc = {
                securityGroupIds: [_this14.x_state.config_node.vpc.security_group_id],
                subnetIDs: []
              };

              if (_this14.x_state.secrets.vpc) {
                data.provider.vpc.securityGroupIds = ['${self:custom.vpc.SECURITY_GROUP_ID}'];
              }

              if (_this14.x_state.config_node.vpc.subnet1_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET1_ID}');
              if (_this14.x_state.config_node.vpc.subnet2_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET2_ID}');
              if (_this14.x_state.config_node.vpc.subnet3_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET3_ID}');
              if (_this14.x_state.config_node.vpc.subnet4_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET4_ID}');
              if (_this14.x_state.config_node.vpc.subnet5_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET5_ID}');
              if (_this14.x_state.config_node.vpc.subnet6_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET6_ID}');
              if (_this14.x_state.config_node.vpc.subnet7_id) data.provider.vpc.subnetIDs.push('${self:custom.vpc.SUBNET7_ID}');
            }
          } //aws iam for s3 permissions (x_state.aws_iam) (@TODO later - cfc:12990)

          /*
          data.provider.iamRoleStatements = {
              Effect: 'Allow'
          };*/
          //nuxt handler


          data.functions = {
            nuxt: {
              handler: 'index.nuxt',
              events: [{
                'http': 'ANY /'
              }, {
                'http': 'ANY /{proxy+}'
              }]
            }
          };

          if (_this14.x_state.central_config['keep-warm']) {
            data.functions.nuxt.events.push({
              schedule: 'rate(20 minutes)'
            });
          } //aws resources for s3 (x_state.aws_resources) (@TODO later - no commands use them - cfc:13017)
          //serverless plugins


          data.plugins = ['serverless-apigw-binary', 'serverless-offline', 'serverless-prune-plugin'];
          if (_this14.x_state.central_config.dominio) data.plugins.push('serverless-domain-manager'); //write yaml to disk

          var _content = yaml.stringify(data);

          var path = require('path');

          var target = path.join(_this14.x_state.dirs.app, "serverless.yml");
          yield _this14.writeFile(target, _content); //debug
          //this.debug('future serverless.yml', content);
        }
      })();
    }

    getExpressModels() {
      var _this15 = this;

      return _asyncToGenerator(function* () {
        var sort = function sort(obj) {
          return Object.entries(obj).sort((a, b) => a[0].length - b[0].length).map(el => el[0]);
        };

        var express_models = {}; // grouped functions by main path folder

        var routes = {
          raw: {},
          ordered: []
        };

        for (var key in _this15.x_state.functions) {
          var file = key.split('_')[0];

          if (!express_models[file]) {
            express_models[file] = {
              functions: {},
              ordered_functions: [],
              imports: {},
              route: file,
              model: file,
              path: "/".concat(file, "/")
            };
          }

          if (!express_models[file].functions[key]) {
            express_models[file].functions[key] = _this15.x_state.functions[key];
          }

          express_models[file].ordered_functions = sort(express_models[file].functions); // merge function's imports into dad (e_model) imports

          for (var import_name in _this15.x_state.functions[key].imports) {
            express_models[file].imports[import_name] = import_name;
          } // add pathlen key for later struct sort


          if (typeof _this15.x_state.functions[key].path == 'string') {
            express_models[file].functions[key].pathlen = _this15.x_state.functions[key].path.length;
          }

          if (express_models[file].functions[key].visible == true) {
            routes.raw["/".concat(file, "/")] = file;
          }
        }

        routes.ordered = sort(routes.raw);
        var resp = {
          models: express_models,
          routes
        };
        return resp;
      })();
    }

    writeTemplate(template, target, context) {
      var _this16 = this;

      return _asyncToGenerator(function* () {
        var path = require('path'),
            fs = require('fs').promises;

        var handlebars = require('handlebars');

        var app_template = path.join(__dirname, template + '.hbs');
        var app_template_ = yield fs.readFile(app_template, 'utf8');
        var appTemplate = handlebars.compile(app_template_);
        var content = appTemplate(context);
        var appjs = path.join(_this16.x_state.dirs.app, target);
        yield _this16.writeFile(appjs, content);
      })();
    }

    createAppJS(express) {
      var _this17 = this;

      return _asyncToGenerator(function* () {
        //const path = require('path'), fs = require('fs').promises;
        //const handlebars = require('handlebars');
        // create app_routes code
        var app_routes = [];

        for (var route_x in express.routes.ordered) {
          var route = express.routes.ordered[route_x];
          app_routes.push("app.use('".concat(route, "', require('./routes/").concat(express.routes.raw[route], "'));"));
        } // content
        //let app_template = path.join(__dirname,'templates','app.hbs');
        //const app_template_ = await fs.readFile(app_template, 'utf8');
        //const appTemplate = handlebars.compile(app_template_);


        var app_context = {
          imports: [],
          code: ''
        };
        content = "var cors = require('cors'),\n                    session = require('express-session'),\n                    path = require('path'),\n                    favicon = require('serve-favicon'),\n                    logger = require('morgan'),\n                    cookieParser = require('cookie-parser'),\n                    bodyParser = require('body-parser'),\n                    // NodeGeocoder: es utilizado para realizar la geo decodificacion y codificacion de lat-lon o direccion.\n                    //NodeGeocoder = require('node-geocoder'),\n                    // Mysql: es la instancia de mysql global.\n                    mysql = require('mysql2'),\n                    helmet = require('helmet'),\n                    // Cluster: es para realizar un cluster de servidor conectados por express.\n                    cluster = require('express-cluster'),\n                    // schedule: es usado para crear crons.\n                    schedule = require('node-schedule'),\n                    // Request: es utilizado para realizar las llamadas get y post hacia otros servicios o servicios internos.\n                    request = require('request'),\n                    compress = require('compression')();\n                // Define en las variables del enviroment el TimeZone a utc.\n                process.env.TZ = 'utc';\n                \n                cluster(async function(worker) {\n                var app = express();\n                var port = process.env.APP_PORT;\n        "; // create cors origin options

        var cors_options = {};

        if (_this17.x_state.config_node.cors) {
          cors_options.origin = [];

          for (var x in _this17.x_state.config_node.cors) {
            cors_options.origin.push(_this17.x_state.config_node.cors[x]);
          }
        } //


        content += "app.enable('trust proxy');\n        app.options('*',cors());\n        app.use(cors(".concat(_this17.jsDump(cors_options), "));\n        app.use(compress);\n        app.use(helmet());\n        app.disable('x-powered-by');\n        app.use(session({\n          secret: 'c-r-34707$ee$$$10nBm_api',\n          resave: true,\n          saveUninitialized: true\n        }));\n        app.set('views', __dirname + '/views');\n        app.set('view engine', 'ejs');\n        //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));\n        app.use(logger('dev'));\n        app.use(bodyParser.urlencoded({ extended: false,limit: '2gb' }));\n        app.use(bodyParser.json({ extended: false,limit: '2gb' }));\n        app.use(cookieParser());\n        app.use(express.static(path.join(__dirname, 'public')));\n        app.use('/', require('./routes/index'));\n        ").concat(app_routes.join('\n'), "\n        // catch 404 and forward to error handler\n        app.use(function(req, res, next) {\n          var err = new Error('Not Found');\n          err.status = 404;\n          next(err);\n        });\n        // error handler\n        app.use(function(err, req, res, next) {\n          // set locals, only providing error in development\n          res.locals.message = err.message;\n          res.locals.error = process.env.START_TYPE === 'development' ? err : {};\n      \n          // render the error page\n          res.status(err.status || 500);\n          res.render('error');\n        });\n        process.env.UV_THREADPOOL_SIZE = 128;\n        // aqui van los schedules @TODO 1-6-19\n        // aqui creamos el servidor\n");
        content += "return app.listen(port, function () {\n                            console.log(`T: ${new Date().toLocaleString()} | EXPRESS (${process.env.START_TYPE}): server listening on port ${port}`);\n                            console.log(`SERVIDOR INICIADO`);\n                        });\n";
        content += "// Al final creamos el cluster del servidor.\n                    }, {count: process.env.CLUSTER});\n"; //post-processing

        yield writeTemplate('app', 'app.js', app_context); //let content = appTemplate(app_context);
        //write file
        //let appjs = path.join(this.x_state.dirs.app,'app.js');
        //await this.writeFile(appjs,content);
      })();
    }

    createIndex(express) {
      var _this18 = this;

      return _asyncToGenerator(function* () {
        var path = require('path'); // get path routes


        var app_routes = [];

        for (var route_x in express.routes.ordered) {
          var route = express.routes.ordered[route_x];
          if (route.charAt(0) == '/') route = route.right(route.length - 1);
          var no_slash = route.replaceAll('/', '');
          app_routes.push("case '".concat(no_slash, "':\n                                res.redirect('/');\n                                break;\n                             case '").concat(route, "':\n                                res.redirect('/');\n                                break;\n                            "));
        } // create content


        var content = "var express = require('express');\n        var router = express.Router();\n        var path = require('path');\n\n        var apicache = require('apicache');\n        var cache = apicache.middleware;\n\n        // rutas por defecto para documentacion\n        router.get(['/*'], function(req, res, next) {\n            switch (req.url) {\n                case \"/\":\n                    res.send('OK');\n                break;\n                ".concat(app_routes.join('\n'), "\n                default:\n                    res.redirect('/');\n                break;\n            }\n        });\n        module.exports = router;\n"); // write file

        var target = path.join(_this18.x_state.dirs.routes, 'index.js');
        yield _this18.writeFile(target, content);
      })();
    }

    createRoutes(express) {
      var _this19 = this;

      return _asyncToGenerator(function* () {
        var listDeleteAt = function listDeleteAt(list, position, delimiter) {
          delimiter = delimiter === undefined ? "," : delimiter;
          var arr = list.split(delimiter);

          if (position >= 1 && position <= arr.length) {
            arr.splice(position - 1, 1);
            return arr.join(delimiter);
          }

          return list;
        };

        var cleanLinesDoc = function cleanLinesDoc(text) {
          //trim each line
          var resp = '',
              lines = text.split('\n'),
              used = 0;

          for (var line in lines) {
            var t_line = lines[line].trim();

            if (t_line != '') {
              if (used != 0) resp += ' * ';
              resp += t_line + '\n';
              used += 1;
            }
          }

          resp += ' * ';
          return resp;
        };

        var ccase = require('fast-case'),
            path = require('path'); // create routes files from express models


        for (var file in express.models) {
          // get unique sub-routes
          var unique = {};

          for (var func of express.models[file].ordered_functions) {
            if (express.models[file].functions[func] && express.models[file].functions[func].path) {
              var _path3 = express.models[file].functions[func].path.trim().split('/');

              _path3.pop(); //remove last item


              _path3 = _path3.join('/');

              if (!unique[_path3] && _path3.includes('/') == true && _path3 != '/' + file) {
                unique[_path3] = _path3.replaceAll('/', '_');
                if (unique[_path3].charAt(0) == '_') unique[_path3] = unique[_path3].substr(1, unique[_path3].length - 1);
              }
            }
          } // code


          var _content2 = "/**\n * Servicios en ruta /".concat(file, "\n * @namespace {object} ").concat(file, "\n */\nvar express = require('express');\nvar router = express.Router();\n\nvar apicache = require('apicache');\nvar cache = apicache.middleware;\n\nvar ").concat(file, " = require('../models/").concat(file, "');\n            ");

          if (Object.keys(unique).length > 0) _content2 += "// declaracion de sub-rutas en esta ubicacion\n";

          for (var route in unique) {
            _content2 += "/**\n * Servicios en ruta ".concat(route, "\n * @namespace {object} ").concat(unique[route], "\n */\n");
          } // write each function signature


          for (var _func of express.models[file].ordered_functions) {
            if (express.models[file].functions[_func] && express.models[file].functions[_func].path) {
              // write jsdoc info for function
              var _jsdoc = {
                method: express.models[file].functions[_func].method.toLowerCase(),
                path_o: express.models[file].functions[_func].path.trim(),
                doc: cleanLinesDoc(express.models[file].functions[_func].doc)
              };
              if (_jsdoc.path_o.charAt(0) == '/') _jsdoc.path_o = _jsdoc.path_o.substr(1, _jsdoc.path_o.length - 1);
              if (_jsdoc.doc == '') _jsdoc.doc = 'Funcion no documentada'; //console.log('PABLO debug without first0:',_jsdoc.path_o);

              var without_first = listDeleteAt(_jsdoc.path_o, 1, '/'); //console.log('PABLO debug without first1:',without_first);

              _jsdoc.path = "/".concat(without_first);
              _jsdoc.method_name = _jsdoc.path_o.split('/').pop(); // last / item; f_jname

              _jsdoc.memberof = listDeleteAt(_jsdoc.path_o, _jsdoc.path_o.split('/').length, '/');
              _jsdoc.memberof = _jsdoc.memberof.replaceAll('_', '|').replaceAll('/', '_');
              var doc = "/**\n * (".concat(_jsdoc.method.toUpperCase(), ") ").concat(_jsdoc.doc, "\n * @method\n * @name ").concat(_func.replaceAll('_', ' / ').replaceAll('|', '_'), "\n * @alias ").concat(_jsdoc.method_name, "\n * @memberof! ").concat(_jsdoc.memberof, "\n"); // add params doc of function

              var func_params = express.models[file].functions[_func].params.split(',');

              for (var param of func_params) {
                var param_wstar = param.replaceAll('*', '');

                if (express.models[file].functions[_func].param_doc[param_wstar]) {
                  var p_type = ccase.pascalize(express.models[file].functions[_func].param_doc[param_wstar].type);

                  var p_desc = express.models[file].functions[_func].param_doc[param_wstar].desc.trim();

                  doc += " * @param {".concat(p_type, "} ").concat(param, " ").concat(p_desc, "\n");
                } else {
                  if (param.trim() == 'id' && !param.includes('identificador')) {
                    doc += " * @param {Int} ".concat(param, "\n");
                  } else if (param.includes('base64')) {
                    doc += " * @param {Base64} ".concat(param, "\n");
                  } else {
                    doc += " * @param {String} ".concat(param, "\n");
                  }
                }
              } // return


              if (express.models[file].functions[_func].param_doc.return) {
                var _p_type = ccase.pascalize(express.models[file].functions[_func].param_doc.return.type);

                var _p_desc = express.models[file].functions[_func].param_doc.return.desc.trim();

                doc += "* @return {".concat(_p_type, "} ").concat(_p_desc, "\n");
              } else if (_jsdoc.doc.includes('@return') == false) {
                doc += "* @return {object}\n";
              }

              doc += " */\n"; // router code

              if (express.models[file].functions[_func].cache != '') {
                doc += "router.".concat(_jsdoc.method, "('").concat(_jsdoc.path, "', cache('").concat(express.models[file].functions[_func].cache, "'), async function(req, res, next) {\n                            await ").concat(file, ".").concat(_func, "(req, res);\n                        });\n");
              } else {
                doc += "router.".concat(_jsdoc.method, "('").concat(_jsdoc.path, "', async function(req, res, next) {\n                            await ").concat(file, ".").concat(_func, "(req, res);\n                        });\n");
              } // add doc to content if func is visible


              if (express.models[file].functions[_func].visible == true) {
                _content2 += doc + '\n';
              } // 

            }
          } // write exports


          _content2 += "module.exports = router;\n"; // write file

          var target = path.join(_this19.x_state.dirs.routes, file + '.js');
          yield _this19.writeFile(target, _content2);
        }
      })();
    }

    createModels(express) {
      var _this20 = this;

      return _asyncToGenerator(function* () {
        var path = require('path');

        for (var file in express.models) {
          var _content3 = "//funciones para ruta ".concat(file, "\n");

          if (_this20.x_state.config_node.aurora) {
            _content3 += "const connectToDatabase = require('../db'); // initialize connection\n";
          } //requires


          var requires = [];

          if (_this20.deploy_module.codeForModel) {
            var deploy_require = yield _this20.deploy_module.codeForModel(express.models[file]);
            requires = [...requires, ...deploy_require];
          } // add express models imports


          for (var imp in express.models[file].imports) {
            requires.push("var ".concat(imp.replaceAll('-', '').replaceAll('@', '').replaceAll('/', '_'), " = require('").concat(imp, "');"));
          } // write header of model


          _content3 += "const Sequelize = require('sequelize'); // sequelize handler\n            var moment = require('moment');\n            //cache support\n            const NodeCache = require(\"node-cache\");\n            const object_hash = require(\"object-hash\");\n            const cache = new NodeCache({ useClones:false });\n            //\n            var util = require('util');\n            var async = require('async');\n            var _ = require('underscore');\n            var fs = require('fs');\n            const fileType = require('file-type');\n            var path = require('path');\n            // requires globales segun requerimiento de codigos de funciones\n            ".concat(requires.join('\n'), "\n            // funciones para cada ruta\n            var self = {};\n"); // add function code

          _content3 += express.models[file].code; // replace db connection info on funcs init { file_init }

          for (var func in express.models[file].functions) {
            if (express.models[file].functions[func] && express.models[file].functions[func].used_models) {
              var db_conn = "const { ".concat(Object.keys(express.models[file].functions[func].used_models), " } = await connectToDatabase();");
              _content3 = _content3.replaceAll("{ ".concat(func, "_init }"), db_conn);
            }
          } // write exports


          _content3 += "module.exports = self;\n"; // write file

          var target = path.join(_this20.x_state.dirs.models, file + '.js');
          yield _this20.writeFile(target, _content3);
        }
      })();
    }

    onEnd() {
      var _this21 = this;

      return _asyncToGenerator(function* () {
        //execute deploy (npm install, etc) AFTER vue compilation (18-4-21: this is new)
        if (!_this21.errors_found) {
          if (!(yield _this21.deploy_module.deploy()) && !_this21.x_state.central_config.componente) {
            _this21.x_console.outT({
              message: 'Something went wrong deploying, check the console, fix it and run again.',
              color: 'red'
            });

            yield _this21.deploy_module.post(); // found errors deploying

            process.exit(100);
          } else {
            yield _this21.deploy_module.post();
          }
        } else {
          //found errors compiling
          process.exit(50);
        }
      })();
    }

    exists(dir_or_file) {
      return _asyncToGenerator(function* () {
        var fs = require('fs').promises;

        try {
          yield fs.access(dir_or_file);
          return true;
        } catch (e) {
          return false;
        }
      })();
    }

    prettyCode() {
      var _arguments = arguments;
      return _asyncToGenerator(function* () {
        var ext = _arguments.length > 0 && _arguments[0] !== undefined ? _arguments[0] : 'js';
        var content = _arguments.length > 1 ? _arguments[1] : undefined;

        var prettier = require('prettier'),
            resp = content;

        if (ext == 'js') {
          try {
            resp = prettier.format(resp, {
              parser: 'babel',
              useTabs: true,
              singleQuote: true
            });
          } catch (ee) {
            //this.debug(`error: could not format the JS file; trying js-beautify`);
            var beautify = require('js-beautify');

            var beautify_js = beautify.js;
            resp = beautify_js(resp, {});
          }
        }

        return resp;
      })();
    }

    writeFile(file, content) {
      var _arguments2 = arguments,
          _this22 = this;

      return _asyncToGenerator(function* () {
        var encoding = _arguments2.length > 2 && _arguments2[2] !== undefined ? _arguments2[2] : 'utf-8';

        var fs = require('fs').promises,
            prettier = require('prettier');

        var ext = file.split('.').splice(-1)[0].toLowerCase();
        var resp = content;

        if (ext == 'js') {
          try {
            resp = prettier.format(resp, {
              parser: 'babel',
              useTabs: true,
              singleQuote: true
            });
          } catch (ee) {
            _this22.debug("error: could not format the JS file; trying js-beautify");

            var beautify = require('js-beautify');

            var beautify_js = beautify.js;
            resp = beautify_js(resp, {});
          }
        } else if (ext == 'json') {
          resp = prettier.format(resp, {
            parser: 'json'
          });
        } else if (ext == 'vue') {
          try {
            resp = prettier.format(resp.replaceAll("=\"xpropx\"", ''), {
              parser: 'vue',
              htmlWhitespaceSensitivity: 'ignore',
              useTabs: true,
              printWidth: 2000,
              embeddedLanguageFormatting: 'auto',
              singleQuote: true,
              trailingComma: 'none'
            });
          } catch (ee) {
            _this22.debug("warning: could not format the vue file; trying vue-beautify", ee);

            var _beautify = require('js-beautify');

            var beautify_vue = _beautify.html;
            resp = beautify_vue(resp, {});
          }
        } else if (ext == 'css') {
          resp = prettier.format(resp, {
            parser: 'css'
          });
        }

        yield fs.writeFile(file, resp, encoding);
      })();
    } //Transforms the processed nodes into files.


    onCreateFiles(processedNodes) {
      var _this23 = this;

      return _asyncToGenerator(function* () {
        require('fs').promises;
            var path = require('path'); //this.x_console.out({ message:'onCreateFiles', data:processedNodes });
        //this.x_console.out({ message:'x_state', data:this.x_state });


        yield _this23._writeModelos();
        yield _this23.createGitIgnore(); //write .npmrc file for ffmpeg support

        yield _this23.writeFile(path.join(_this23.x_state.dirs.app, '.npmrc'), "unsafe-perm=true");

        _this23.debug('processing nodes'); //console.log('PABLO debug x_state function general/login',this.x_state.functions.general_login);
        //console.log('PABLO debug create nodes',processedNodes);
        //group functions into express models (first folder is dad model)


        var express = yield _this23.getExpressModels(); //let express = { models:express_base.models, routes:express_base.routes }; // grouped functions by main path folder
        // add code to express models

        for (var thefile_num in processedNodes) {
          var thefile = processedNodes[thefile_num];

          if (express.models[thefile.file]) {
            express.models[thefile.file].code = thefile.code;
          }
        } //console.log('PABLO debug EXPRESS models',express.models);


        yield _this23.createAppJS(express);
        yield _this23.createIndex(express);
        yield _this23.createErrorTemplate();
        yield _this23.createJSDoc();
        yield _this23.createReadme();
        yield _this23.createBinFile();
        yield _this23.createRoutes(express);
        yield _this23.createModels(express); // *************************
        // Additional steps
        // *************************
        //create package.json

        yield _this23.createPackageJSON(); //create package.json
        //await this.createPackageJSON();
        //create VSCode helpers
        //await this.createVSCodeHelpers();
        //create serverless.yml for deploy:sls - cfc:12881
        //await this.createServerlessYML();
        //execute deploy (npm install, etc) - moved to onEnd
      })();
    } // ************************
    // INTERNAL HELPER METHODS 
    // ************************

    /*
     * Returns true if a local server is running on the DSL defined port
     */


    _isLocalServerRunning() {
      var _this24 = this;

      return _asyncToGenerator(function* () {
        var is_reachable = require('is-port-reachable');

        var resp = yield is_reachable(_this24.x_state.central_config.port);
        return resp;
      })();
    }
    /*
     * Reads the node called modelos and creates tables definitions and managing code (alias:database).
     */


    _readModelos() {
      var _this25 = this;

      return _asyncToGenerator(function* () {
        // @IDEA this method could return the insert/update/delete/select 'function code generators'
        _this25.debug('_readModelos');

        _this25.debug_time({
          id: 'readModelos'
        });

        var modelos = yield _this25.dsl_parser.getNodes({
          text: 'modelos',
          level: 2,
          icon: 'desktop_new',
          recurse: true
        }); //nodes_raw:true	

        var tmp = {
          appname: _this25.x_state.config_node.name
        },
            fields_map = {};
        var resp = {
          tables: {},
          attributes: {},
          length: 0,
          doc: ''
        }; // map our values to real database values 

        var type_map = {
          id: {
            value: 'INT AUTOINCREMENT PRIMARY KEY',
            alias: ['identificador', 'autoid', 'autonum', 'key']
          },
          string: {
            value: 'STRING',
            alias: ['varchar', 'string']
          },
          text: {
            value: 'TEXT',
            alias: ['texto', 'largo']
          },
          smalltext: {
            value: "TEXT('tiny')",
            alias: ['textochico', 'textocorto', 'corto']
          },
          int: {
            value: 'INTEGER',
            alias: ['numero chico', 'small int', 'numero']
          },
          float: {
            value: 'FLOAT',
            alias: ['decimal', 'real']
          },
          boolean: {
            value: 'BOOLEAN',
            alias: ['boleano', 'true/false']
          },
          date: {
            value: 'DATEONLY',
            alias: ['fecha']
          },
          datetime: {
            value: 'DATETIME',
            alias: ['fechahora']
          },
          blob: {
            value: 'BLOB',
            alias: ['binario', 'binary']
          }
        }; // expand type_map into fields_map

        Object.keys(type_map).map(function (x) {
          var aliases = type_map[x].alias;
          aliases.push(x);
          aliases.map(y => {
            fields_map[y] = type_map[x].value;
          });
        }); // search real modelos nodes (ignore folders)

        var modelos_x = [];

        if (modelos.length > 0) {
          var ccase = require('fast-case');

          for (var main of modelos[0].nodes) {
            if (main.icons.includes('list')) {
              for (var child of main.nodes) {
                var with_folder = _objectSpread2({}, child); //@change: this is a breaking change - 23-may-21


                with_folder.text = ccase.camelize(main.text) + '/' + ccase.camelize(child.text);
                modelos_x.push(with_folder);
              }
            } else {
              // this is a real modelo node
              modelos_x.push(main);
            }
          }
        }

        modelos = [{
          nodes: modelos_x
        }]; // parse nodes into tables with fields

        if (modelos.length > 0) {
          //modelos[0].attributes.map(x=>{ resp.attributes={...resp.attributes,...x} }); //modelos attributes
          resp.attributes = _objectSpread2({}, modelos[0].attributes);
          resp.doc = modelos[0].text_note;
          resp.length = modelos[0].nodes.length;

          var extract = require('extractjs')();

          for (var table of modelos[0].nodes) {
            var fields = _objectSpread2({}, table.attributes); //table.attributes.map(x=>{ fields={...fields,...x} }); //table attributes


            resp.tables[table.text] = {
              fields: {}
            }; //create table

            tmp.sql_fields = [];

            for (var field in fields) {
              //console.log('fields_map',{field,fields});
              if (fields[field].includes('(')) {
                var parts = extract("{type}({amount})", fields[field]);
                resp.tables[table.text].fields[field] = fields_map[parts.type] + "(".concat(parts.amount, ")"); //assign field with mapped value

                tmp.sql_fields.push(field + ' ' + fields_map[fields[field]]);
              } else if (field.charAt(0) != ':') {
                resp.tables[table.text].fields[field] = fields_map[fields[field]]; //assign field with mapped value

                tmp.sql_fields.push(field + ' ' + fields_map[fields[field]]);
              }
            }

            resp.tables[table.text].sql = "CREATE TABLE ".concat(table.text, "(").concat(tmp.sql_fields.join(','), ")"); // test special attrs

            if (fields[':dbname']) resp.tables[table.text].db = table[':dbname'];
            if (fields[':tipo']) resp.tables[table.text].type = table[':tipo'];
            if (fields[':type']) resp.tables[table.text].type = table[':type'];
            if (fields[':tipo']) resp.tables[table.text].type = table[':tipo'];

            if (fields[':index']) {
              if (!resp.tables[table.text].indexes) resp.tables[table.text].indexes = [];
              resp.tables[table.text].indexes.push({
                name: yield _this25.hash(table.text + '_' + table[':index']),
                unique: false,
                fields: fields[':index'].split(',')
              });
            }

            if (fields[':index_unique']) {
              if (!resp.tables[table.text].indexes) resp.tables[table.text].indexes = [];
              resp.tables[table.text].indexes.push({
                name: yield _this25.hash(table.text + '_' + table[':index_unique']),
                unique: true,
                fields: fields[':index_unique'].split(',')
              });
            } //


            yield _this25.setImmediatePromise(); //@improved
          }
        } // create virtual table 'if' central node 'log'='modelo


        if (_this25.x_state.central_config.log && _this25.x_state.central_config.log.includes('model')) {
          resp.tables['console_log'] = {
            fields: {
              id: 'INT AUTOINCREMENT PRIMARY KEY',
              class: 'STRING',
              method: 'STRING',
              message: 'STRING',
              date: 'DATE'
            }
          };
        } // add sequelize package


        _this25.x_state.npm['sequelize'] = '*';

        _this25.debug_timeEnd({
          id: 'readModelos'
        }); // return 


        return resp;
      })();
    }

    _writeModelos() {
      var _this26 = this;

      return _asyncToGenerator(function* () {
        _this26.debug('_writeModelos');

        _this26.debug_time({
          id: 'writeModelos'
        });

        var path = require('path'),
            fs = require('fs').promises; // ******************************************************
        // create db_models sequelize schema files @todo
        // ******************************************************


        for (var table in _this26.x_state.models.tables) {
          // define file name
          var target_file = [],
              db_name = '';

          if (table.includes('/')) {
            target_file.push(table.split('/')[0]);
            target_file.push(table.split('/').pop() + '.js');
            db_name = target_file[0] + '_' + target_file[1].replace('.js', '');
          } else {
            target_file.push(table + '.js');
            db_name = table;
          }

          var target = path.join(_this26.x_state.dirs.db_models, target_file.join('/')); // create target folder

          var jfolder = path.dirname(target);

          try {
            yield fs.mkdir(jfolder, {
              recursive: true
            });
          } catch (errdir) {} // content


          var fields = _this26.x_state.models.tables[table].fields;
          var model = {}; // map types depending on db type (modelos: central key)

          var map = {
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
            'TEXT(\'tiny\')': "type.TEXT('tiny')",
            'FLOAT': 'type.FLOAT',
            'BOOLEAN': 'type.BOOLEAN',
            'DATEONLY': 'type.DATE',
            'DATETIME': 'type.DATE',
            'BLOB': 'type.BLOB'
          };

          var extract = require('extractjs')(); //console.log('pablo dump fields',{table,fields});


          for (var key in fields) {
            if (fields[key] in map) {
              model[key] = map[fields[key]];
            } else if (fields[key] && fields[key].includes('(')) {
              //example string(10)
              var elements = extract("{field}({amount})", fields[key]);

              if (elements.field in map) {
                model[key] = map[elements.field] + "(".concat(elements.amount, ")");
              }
            }
          } //add indexes


          var _content4 = "";

          if (_this26.x_state.models.tables[table].indexes) {
            //write model with indexes
            var indexes = {
              indexes: _this26.x_state.models.tables[table].indexes
            };
            _content4 = "module.exports = (sequelize, type) => {\n                    return sequelize.define('".concat(db_name, "', ").concat(_this26.jsDump(model, 'type.'), ", ").concat(_this26.jsDump(indexes), ");\n                }");
          } else {
            //write model without indexes
            _content4 = "module.exports = (sequelize, type) => {\n                    return sequelize.define('".concat(db_name, "', ").concat(_this26.jsDump(model, 'type.'), ");\n                }");
          } // write file


          yield _this26.writeFile(target, _content4);
        } // ******************************************************
        // create db.js for 'aurora' if defined on config node
        // ******************************************************


        if (_this26.x_state.config_node.aurora) {
          _this26.x_state.npm['mysql2'] = '*';
          _this26.x_state.npm['sequelize'] = '*';
          var _content5 = "const Sequelize = require('sequelize');\n";

          for (var _table in _this26.x_state.models.tables) {
            if (_table.includes('/')) {
              var _info = {
                folder: '',
                table: ''
              };
              _info.folder = _table.split('/')[0];
              _info.table = _table.split('/').pop();
              _content5 += "const db_".concat(_info.folder, "_").concat(_info.table, " = require('./db_models/").concat(_info.folder, "/").concat(_info.table, "');\n");
            } else {
              _content5 += "const db_".concat(_table, " = require('./db_models/").concat(_table, "');\n");
            }
          }

          var seq_config = {
            logging: _this26.x_state.central_config.dblog == true ? 'func:logging' : false,
            dialect: 'mysql',
            dialectOptions: {
              connectTimeout: 60000
            },
            define: {
              freezeTableName: true
            },
            pool: {
              max: _this26.x_state.central_config.pool_max,
              min: 1,
              acquire: 12000,
              idle: 12000,
              evict: 12000
            },
            operatorAliases: false,
            host: 'process.env.AURORA_HOST',
            port: 'process.env.AURORA_PORT'
          };

          if (_this26.x_state.central_config.dblog == true) {
            seq_config.benchmark = true;
          }

          _content5 += "const colors = require('colors/safe');\n";
          _content5 += "const logging = function(logStr, execTime, options) {\n                if (!options) {\n                    options = execTime;\n                    execTime = undefined;\n                }\n                    \n                let col = null;\n                switch (options.type) {\n                    case 'SELECT':\n                        col = colors.blue.bold;\n                        break;\n                    case 'UPDATE':\n                        col = colors.yellow.bold;\n                        break;\n                    case 'INSERT':\n                        col = colors.green.bold;\n                        break;\n                    default:\n                        col = colors.white.bold;\n                        break;\n                }\n                if (execTime) {\n                    if (execTime >= 10) {\n                        col = colors.red.bold;\n                        console.log(colors.magenta.bold(`[${execTime} ms]`), col(logStr));\n                    } else {\n                        console.log(col(logStr));\n                    }\n                }\n            }\n";
          _content5 += "const sequelize = new Sequelize(\n                process.env.AURORA_NAME,\n                process.env.AURORA_USER,\n                process.env.AURORA_PASSWORD,\n                ".concat(_this26.jsDump(seq_config).replace("'func:logging'", "logging"), "\n            );\n            // check if given database exists, or create it\n            sequelize.query(\"CREATE DATABASE IF NOT EXISTS \"+process.env.AURORA_NAME).then(function(){});\n");
          var models = [];

          for (var _table2 in _this26.x_state.models.tables) {
            if (_table2.includes('/')) {
              var _info2 = {
                folder: '',
                table: ''
              };
              _info2.folder = _table2.split('/')[0];
              _info2.table = _table2.split('/').pop();
              models.push("".concat(_info2.folder, "_").concat(_info2.table));
              _content5 += "const ".concat(_info2.folder, "_").concat(_info2.table, " = db_").concat(_info2.folder, "_").concat(_info2.table, "(sequelize, Sequelize);\n");
            } else {
              models.push(info.table);
              _content5 += "const ".concat(_table2, " = db_").concat(_table2, "(sequelize, Sequelize);;\n");
            }
          } // add closing code


          _content5 += "const Models = { ".concat(models.join(','), " }\n\n            const connection = {};\n\n            module.exports = async() => {\n                if (connection.isConnected) {\n                    console.log('=> Using existing connection.');\n                    return Models;\n                }\n\n                await sequelize.sync({ alter:").concat(_this26.x_state.central_config.dbalter, " });\n                await sequelize.authenticate()\n                connection.isConnected = true;\n                console.log('=> Created a new connection.');\n                return Models;\n            }\n            "); // write db.js file

          var _target2 = path.join(_this26.x_state.dirs.app, 'db.js');

          yield _this26.writeFile(_target2, _content5);
        }

        _this26.debug_timeEnd({
          id: 'writeModelos'
        });
      })();
    }
    /* 
     * Grabs central node configuration information
     */


    _readCentralConfig() {
      var _this27 = this;

      return _asyncToGenerator(function* () {
        _this27.debug('_readCentralConfig');

        var central = yield _this27.dsl_parser.getNodes({
          level: 1,
          recurse: false
        }); //this.debug('central search',central);
        // set defaults

        var resp = {
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
          'rtc:admin': '',
          port: 8081,
          git: true,
          readme: central[0].text_note.trim(),
          'keep-alive': true,
          'keep-warm': true,
          ':cache': _this27.x_config.cache,
          ':keywords': '',
          ':author': 'Punto Origen SpA',
          ':license': 'MIT',
          ':github': '',
          ':version': '1.0.0',
          ':description': central[0].text_note,
          default_face: central[0].font.face,
          default_size: central[0].font.size,
          apptitle: central[0].text
        }; // overwrite default resp with info from central node
        //resp = {...resp, ...central[0].attributes };
        //bit slower but transforms string booleans (19-4-21)

        var values = {};

        for (var xz in central[0].attributes) {
          var x = central[0].attributes[xz];

          if (x == 'true') {
            x = true;
          } else if (x == 'false') {
            x = false;
          }

          values = _objectSpread2(_objectSpread2({}, values), {
            [xz]: x
          });
        }

        resp = _objectSpread2(_objectSpread2({}, resp), values);
        /*central[0].attributes.map(function(x) {
        	resp = {...resp,...x};
        });*/

        if (resp.dominio) {
          resp.service_name = resp.dominio.replace(/\./g, '').toLowerCase();
        } else {
          resp.service_name = resp.apptitle;
        }

        if (!resp[':cache']) _this27.x_config.cache = false; // disables cache when processing nodes (@todo)
        // return

        return resp;
      })();
    }
    /* helper for readConfig and secrets extraction */


    configFromNode(resp, key) {
      if (key.icons.includes('button_cancel') == false) {
        if (Object.keys(key.attributes).length > 0) {
          // prepare config key
          var config_key = key.text.toLowerCase().replace(/ /g, ''); //alt1 let values = {...key.attributes }; 
          //alt2, bit slower but considers booleans as string

          var values = {};

          for (var xz in key.attributes) {
            var x = key.attributes[xz];

            if (x == 'true') {
              x = true;
            } else if (x == 'false') {
              x = false;
            }

            values = _objectSpread2(_objectSpread2({}, values), {
              [xz]: x
            });
          }

          resp[config_key] = values; // mark secret status true if contains 'password' icon

          if (key.icons.includes('password')) {
            resp[config_key][':secret'] = true;
            if (!resp['::secrets']) resp['::secrets'] = [];
            resp['::secrets'].push(key); //add key as secret
          } // add link attribute if defined


          if (key.link != '') resp[config_key][':link'] = key.link;
        } else if (key.nodes.length > 0) {
          resp[key.text] = key.nodes[0].text;
        } else if (key.link != '') {
          resp[key.text] = key.link;
        } //


        if (key.text == ':secrets' && key.icons.includes('password')) {
          resp[':secrets'] = key.text_note.replaceAll('\n', '').trim();
        }
      }

      return resp;
    }
    /*
     * Grabs the configuration from node named 'config'
     */


    _readConfig() {
      var _arguments3 = arguments,
          _this28 = this;

      return _asyncToGenerator(function* () {
        var delete_secrets = _arguments3.length > 0 && _arguments3[0] !== undefined ? _arguments3[0] : true;

        _this28.debug('_readConfig');

        var path = require('path');
            require('fs').promises;

        var resp = {
          id: '',
          meta: [],
          seo: {}
        },
            config_node = {};
        var search = yield _this28.dsl_parser.getNodes({
          text: 'config',
          level: 2,
          icon: 'desktop_new',
          recurse: true
        }); //this.debug({ message:'search says',data:search, prefix:'_readConfig,dim' });
        //let secrets = []; // secret nodes for encrypted export
        //

        if (search.length > 0) {
          config_node = search[0]; // define default font_face

          if (!delete_secrets) resp[':id'] = config_node.id;
          resp.default_face = config_node.font.face;
          resp.default_size = config_node.font.size; // apply children nodes as keys/value for resp

          for (var key of config_node.nodes) {
            // apply keys as config keys (standard config node by content types)
            resp = _objectSpread2(_objectSpread2({}, resp), _this28.configFromNode(resp, key)); //console.log('dump:'+key.text,this.configFromNode(key));
            //
          }
        } // assign dsl file folder name+filename if node.name is not given


        if (!resp.name) {
          var dsl_folder = path.dirname(path.resolve(_this28.x_flags.dsl));
          var parent_folder = path.resolve(dsl_folder, '../');
          var folder = dsl_folder.replace(parent_folder, '');
          resp.name = folder.replace('/', '').replace('\\', '') + '_' + path.basename(_this28.x_flags.dsl, '.dsl'); //console.log('folder:',{folder,name:resp.name});
          //this.x_flags.dsl
        } // create id if not given


        if (!resp.id) resp.id = 'com.puntorigen.' + resp.name; // *********************************************

        if (delete_secrets == true) delete resp[':secrets'];
        return resp;
      })();
    }

    getParentNodes() {
      var _arguments4 = arguments,
          _this29 = this;

      return _asyncToGenerator(function* () {
        var id = _arguments4.length > 0 && _arguments4[0] !== undefined ? _arguments4[0] : _this29.throwIfMissing('id');
        var exec = _arguments4.length > 1 && _arguments4[1] !== undefined ? _arguments4[1] : false;
        var parents = yield _this29.dsl_parser.getParentNodesIDs({
          id,
          array: true
        });
        var resp = [];

        for (var parent_id of parents) {
          var node = yield _this29.dsl_parser.getNode({
            id: parent_id,
            recurse: false
          });
          var command = yield _this29.findValidCommand({
            node,
            object: exec
          });
          if (command) resp.push(command);
          yield setImmediatePromise(); //@improved
        }

        return resp;
      })();
    } //objeto to attributes tag version


    struct2params() {
      var struct = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.throwIfMissing('id');

      var resp = [],
          tmp = _objectSpread2({}, struct); // pre-process


      if ('aos' in tmp) {
        var aos_p = struct['aos'].split(',');

        if (aos_p.length == 3) {
          tmp['data-aos'] = aos_p[0];
          tmp['data-aos-duration'] = aos_p[1];
          tmp['data-aos-delay'] = aos_p[2];
        } else {
          tmp['data-aos'] = aos_p[0];
          tmp['data-aos-duration'] = aos_p[1];
        }

        delete tmp['aos'];
      } // process


      for (var [key, value] of Object.entries(tmp)) {
        if (value == null) {
          //needed cause cheerio assigns empty values to props, and vue props don't have values
          //little hack that works together with writeFile method
          resp.push("".concat(key, "=\"xpropx\""));
        } else if (typeof value !== 'object' && typeof value !== 'function' && typeof value !== 'undefined') {
          resp.push("".concat(key, "=\"").concat(value, "\""));
        } else if (typeof value === 'object') {
          //serialize value
          resp.push("".concat(key, "=\"").concat(this.jsDump(value), "\""));
        }
      }

      return resp.join(' ');
    } //serializes the given obj escaping quotes from values containing js code


    jsDump(obj) {
      var leave_as_is_if_contains = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      var resp = '';

      var isNumeric = function isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
      };

      var escape = function escape(obi) {
        var nuevo = '',
            ob = obi; //special escapes first

        if (typeof ob === 'string') ob = ob.replaceAll('{now}', 'new Date()'); //

        if (typeof ob === 'number') {
          nuevo += ob;
        } else if (typeof ob === 'boolean') {
          nuevo += ob;
        } else if (typeof ob === 'string' && ob.substr(0, 2) == '**' && ob.substr(ob.length - 2) == '**') {
          nuevo += ob.replaceAll('**', ''); //escape single ** vars 21-abr-21
        } else if (typeof ob === 'string' && (ob.charAt(0) == '!' || ob.indexOf('this.') != -1 || ob.indexOf('new ') != -1 || ob.indexOf("'") != -1 || ob.indexOf('`') != -1 || leave_as_is_if_contains != '' && ob.indexOf(leave_as_is_if_contains) != -1 || ob.includes('process.') || ob.charAt(0) != '0' && isNumeric(ob) || ob == '0' || ob == 'true' || ob == 'false')) {
          nuevo += ob;
        } else if (typeof ob === 'string') {
          nuevo += "'".concat(ob, "'");
        } else {
          nuevo += ob;
        }

        return nuevo;
      };

      if (Array.isArray(obj)) {
        var tmp = [];

        for (var item in obj) {
          tmp.push(this.jsDump(obj[item], leave_as_is_if_contains));
        }

        resp = "[".concat(tmp.join(','), "]");
      } else if (typeof obj === 'object') {
        var _tmp = [];

        for (var llave in obj) {
          var llavet = llave;
          if (llavet.includes('-') && llavet.includes("'") == false) llavet = "'".concat(llave, "'");
          var nuevo = "".concat(llavet, ": ");
          var valor = obj[llave];

          if (typeof valor === 'object' || Array.isArray(valor)) {
            nuevo += this.jsDump(valor, leave_as_is_if_contains);
          } else {
            nuevo += escape(valor);
          }

          _tmp.push(nuevo);
        }

        resp = "{\n".concat(_tmp.join(','), "\n}");
      } else if (typeof obj === 'string') {
        resp = escape(obj);
      } else {
        resp = obj;
      }

      return resp;
    } // hash helper method


    hash(thing) {
      var _this30 = this;

      return _asyncToGenerator(function* () {
        var resp = yield _this30.dsl_parser.hash(thing);
        return resp;
      })();
    } // atLeastNode


    atLeastNode(r) {
      var n = process.versions.node.split('.').map(x => parseInt(x, 10));
      r = r.split('.').map(x => parseInt(x, 10));
      return n[0] > r[0] || n[0] === r[0] && (n[1] > r[1] || n[1] === r[1] && n[2] >= r[2]);
    }

    setImmediatePromise() {
      //for preventing freezing node thread within loops (fors)
      return new Promise(resolve => {
        setImmediate(() => resolve());
      });
    }

  }

  return fastify_dsl;

}));
