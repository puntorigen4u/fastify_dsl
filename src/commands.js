module.exports = async function(context) {
	// context.x_state; shareable var scope contents between commands and methods.
    String.prototype.replaceAll = function(strReplace, strWith) {
        // See http://stackoverflow.com/a/3561711/556609
        var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var reg = new RegExp(esc, 'ig');
        return this.replace(reg, strWith);
    };
    
    String.prototype.cleanLines = function() {
        var esc = '\n'.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var reg = new RegExp(esc, 'ig');
        return this.replace(reg, '').trim();
    };
    
    String.prototype.contains = function(test) {
        if (typeof this === 'string' && this.indexOf(test) != -1) {
            return true;
        } else {
            return false;
        }
    };
    
    String.prototype.right = function(chars) {
        return this.substr(this.length-chars);
    };
    
    function setImmediatePromise() {
        //for preventing freezing node thread within loops (fors)
        return new Promise((resolve) => {
          setImmediate(() => resolve());
        });
    }
    //
    let null_template = {
        hint: 'Allowed node type that must be ommited',
        func: async function(node, state) {
            return context.reply_template({
                hasChildren: false,
                state
            });
        }
    };
    const parsedHuman = require('human-ms').parseHuman;
    const parseInputOutput = async function(node,state) {
        //get vars and attrs
        let tmp = { var:'', original:'' };
        if (node.text.includes(',')) tmp.var = node.text.split(',').pop().trim();
        //prepare new var
        if (tmp.var.includes('$')) {
            tmp.var = tmp.var.replaceAll('$variables.', 'this.')
                            .replaceAll('$vars.', 'this.')
                            .replaceAll('$params.', 'this.')
                            .replaceAll('$config.', 'process.env.');
            if (tmp.var=='this.') tmp.var='this';
        }
        //prepare original var
        tmp.original = context.dsl_parser.findVariables({
            text: node.text,
            symbol: `"`,
            symbol_closing: `"`
        });
        if (tmp.original.includes('**') && node.icons.includes('bell')) {
            tmp.original = getTranslatedTextVar(tmp.original);
        } else if (tmp.original.includes('$')) {
            tmp.original = tmp.original.replaceAll('$variables.', 'this.')
                                        .replaceAll('$vars.', 'this.')
                                        .replaceAll('$params.', 'this.')
                                        .replaceAll('$config.', 'process.env.');
            if (tmp.original=='this.') tmp.original='this';
        }
        return { input:tmp.original, output:tmp.var };
    };

    const getTranslatedTextVar = function(text,keep_if_same=false) {
        let vars = context.dsl_parser.findVariables({
            text,
            symbol: `**`,
            symbol_closing: `**`
        });
        //console.log('translated text:'+text,vars);
        let new_vars = context.dsl_parser.replaceVarsSymbol({
            text,
            from: {
                open: `**`,
                close: `**`
            },
            to: {
                open: '${',
                close: '}'
            }
        });
        //console.log('translated new_vars text:'+text,new_vars);
        if ('${' + vars + '}' == new_vars) {
            if (keep_if_same==true) return text;
            return vars;
        } else {
            return `\`${new_vars}\``;
        }
    };
    // process our own attributes_aliases to normalize node attributes
    const aliases2params = function(x_id, node, escape_vars, variables_to='',accept_symbol_prefix=false) {
        let params = {},
            attr_map = {};
        // read x_id attributes aliases
        if ('attributes_aliases' in context.x_commands[x_id]) {
            let aliases = context.x_commands[x_id].attributes_aliases;
            Object.keys(aliases).map(function(key) {
                aliases[key].split(',').map(alternative_key => {
                    attr_map[alternative_key] = key
                });
            });
        }
        // process mapped attributes
        Object.keys(node.attributes).map(function(key) {
            let value = node.attributes[key];
            let key_use = key.trim();
            if (key_use.charAt(0)==':' && accept_symbol_prefix==false) key_use = key_use.right(key_use.length-1);
            let keytest = key_use.toLowerCase();
            let tvalue = value.toString().replaceAll('$variables.', variables_to)
                .replaceAll('$vars.', variables_to)
                .replaceAll('$params.', variables_to)
                .replaceAll('$config.', 'process.env.').trim();
            //fix process.env.x.x -> process.env.x_x
            if (tvalue.includes('process.env.') && tvalue.replaceAll('process.env.','').includes('.')) {
                tvalue = 'process.env.'+tvalue.replaceAll('process.env.','').replaceAll('.','_');
            }
            //
            if (tvalue.charAt(0)=='$' && tvalue.includes('$store')==false) {
                tvalue = tvalue.right(tvalue.length-1);
            }
            //
            //tvalue = getTranslatedTextVar(tvalue);
            if (keytest == 'props') {
                value.split(' ').map(x => {
                    params[x] = null
                });
            } else if (keytest in attr_map && value != tvalue) {
                // value contains a variable
                if (attr_map[keytest]=='v-model') {
                	params[attr_map[keytest]] = tvalue;
                } else {
                    if (accept_symbol_prefix==false) {
                	    params[`:${attr_map[keytest]}`] = tvalue;
                    } else {
                	    params[attr_map[keytest]] = tvalue;
                    }
            	}
            } else if (keytest in attr_map) {
                // literal value
                params[attr_map[keytest]] = tvalue;
            } else {
                // this is an attribute key that is not mapped
                if (value != tvalue || value[0]=="$" || value[0]=="!" || key.charAt(0)==':' ) {
                    if (escape_vars && escape_vars==true) {
                        tvalue = tvalue.replaceAll('{{','').replaceAll('}}','');
                    }
                    if (keytest!='v-model') {
                        if (accept_symbol_prefix==false) {
                            params[`:${key_use}`] = tvalue;
                        } else {
                            params[key_use] = tvalue;
                        }
                    } else {
                        params[key_use] = tvalue;
                    }
                } else {
                    params[key_use] = tvalue;
                }
            }
        });
        //
        return params;
    };
    
    return {
        //'cancel': {...null_template,...{ x_icons:'button_cancel'} },
        'meta': {...null_template, ...{
                name: 'AWS EB / NodeJS Express',
                version: '0.0.2',
                x_level: '2000',
            }
        },
        'centralnode': {...null_template,
            ... {
                x_level: '1'
            }
        },
        'def_config': {...null_template,
            ... {
                x_icons: 'desktop_new',
                x_level: '2',
                x_text_contains: 'config'
            }
        },
        'def_modelos': {...null_template,
            ... {
                x_icons: 'desktop_new',
                x_level: '2',
                x_text_contains: 'modelos'
            }
        },


        // ********************
        //  Express Methods
        // ********************

        'def_path': {
            x_icons: 'list',
            x_level: '>1',
            x_icons: 'list',
            x_not_icons: 'button_cancel,desktop_new,help',
            hint: 'Carpeta para ubicacion de funcion de servidor',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //console.log('def_server_path DEBUG',node);
                if (node.icons.includes('password')) {
                    resp.state.public_access = false;
                }
                let test1 = await context.isExactParentID(node.id, 'def_path');
                if (node.level == 2) {
                    //state.current_folder = node.text;
                    resp.state.current_folder = node.text;
                } else if (node.level == 3 && test1==true) {
                    let parent_node = await context.dsl_parser.getParentNode({
                        id: node.id
                    });
                    //state.current_folder = `${parent_node.text}/${node.id}`;
                    resp.state.current_folder = `${parent_node.text}/${node.text}`;
                } else {
                    resp.valid = false;
                }
                return resp;
            }
        },
        'def_function': {
            x_empty: 'icons',
            x_level: '>2',
            x_or_hasparent: 'def_path',
            hint: 'Corresponde a la declaracion de una funcion de servidor',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                resp.state.current_func = node.text;
                if (node.level != 2) {
                    let new_name = resp.state.current_folder?resp.state.current_folder.split('/'):[];
                    resp.state.current_func = [...new_name,node.text].join('_');
                    //console.log('@TODO! def_server_func: new_name',new_name);
                }
                // set function defaults
                if (!context.x_state.functions[resp.state.current_func]) {
                    context.x_state.functions[resp.state.current_func] = {
                        nodeid: node.id,
                        tipo: 'web',
                        acceso: '*',
                        params: '',
                        param_doc: {},
                        cache: '',
                        doc: node.text_note,
                        method: 'get',
                        return: '',
                        visible: (resp.state.public_access)?resp.state.public_access:true,
                        path: '/' + (resp.state.current_folder?resp.state.current_folder+'/':'') + node.text,
                        imports: {},
                        used_models: {}
                    };
                }
                // process attributes
                Object.keys(node.attributes).map(function(keym) {
                    let key = keym.toLowerCase();
                    if ([':type', 'type', 'tipo', ':tipo',':method','method'].includes(key)) {
                        context.x_state.functions[resp.state.current_func].method = node.attributes[key];
                    } else if (['schedule',':schedule'].includes(key)) {
                        //auto-called method
                        //@todo create this (ref:321 cfc)
                    } else if (['schedule:params','schedule:query',':schedule:params',':schedule:query'].includes(key)) {
                        //auto-called method params
                        let value = node.attributes[key];
                        if (value.includes('&') && value.includes(',')==false) {
                            value = value.replaceAll('&',',');
                        }
                        context.x_state.functions[resp.state.current_func]['schedule:params']=value;

                    } else if (['visible',':visible'].includes(key)) {
                        context.x_state.functions[resp.state.current_func].visible = node.attributes[key];
                    } else if (['cache',':cache'].includes(key)) {
                        context.x_state.functions[resp.state.current_func].cache = node.attributes[key];
                    } else {
                        if (key.includes(':')) {
                            context.x_state.functions[resp.state.current_func].param_doc[key.split(':')[0]] = { type:key.split(':')[1], desc:node.attributes[key] };
                        } else {
                            context.x_state.functions[resp.state.current_func][key.toLowerCase().trim()] = node.attributes[key];
                        }
                    }
                    //
                });
                // write tag code
                resp.open += `self.${resp.state.current_func} = async (req, res, asfunc) => {\n`;
                if (context.x_state.functions[resp.state.current_func].method=='get') {
                    resp.open += `let params = req.params;\n`;
                } else {
                    resp.open += `let params = req.body;\n`;
                }
                resp.open += `{ ${resp.state.current_func}_init }\n`; //placeholder for used (to be defined later) db connections
                if (context.x_state.functions[resp.state.current_func].return!='') {
                    resp.close +=  `if (asfunc) {
                                        return ${context.x_state.functions[resp.state.current_func].return};\n
                                    } else {
                                        res.send(${context.x_state.functions[resp.state.current_func].return});
                                    }\n`;
                }
                resp.close += `}\n`;
                context.x_state.functions[resp.state.current_func].code=resp;
                return resp;
            }
        },

        'def_llamar_funcion': {
            x_icons: 'desktop_new',
            x_level: '>2',
            x_not_empty: 'link',
            x_text_contains: 'llamar funcion',
            x_or_hasparent: 'def_function',
            hint: 'Ejecuta funcion enlazada, traspasando atributos como parametros y retornando valor en variable despues de la coma',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = {};
                tmp.var = node.text.split(',').pop().trim(); //last comma element
                //search target functon
                for (let func in context.x_state.functions) {
                    if (context.x_state.functions[func].nodeid==node.link) {
                        tmp.name = func;
                        tmp.func = context.x_state.functions[func];
                        break;
                    }
                }
                if (!tmp.name) return {...resp,...{valid:false}}; //target func not found
                /* alternative to get attributes as obj
                tmp.data = (await context.x_commands['def_struct'].func(node, { ...state, ...{
                    as_object:true
                }}));*/
                //write
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                //context.debug('PABLO debug, comparing ',{ func_name:tmp.name, currentpath:context.x_state.functions[resp.state.current_func].path, func_path:tmp.func.path });
                if (context.x_state.functions[resp.state.current_func].path.split('/')[1]==tmp.func.path.split('/')[1]) {
                    // target function is within our own model
                    resp.open += `var ${tmp.var} = (await self.${tmp.name}({ body:${context.jsDump(node.attributes)} }, res, true ));\n`;
                } else {
                    // target function is on another file
                    tmp.model = tmp.func.path.split('/')[1];
                    resp.open += `let import_${node.id} = require('./${tmp.model}');\n`;
                    resp.open += `var ${tmp.var} = (await import_${node.id}.${tmp.name}({ body:${context.jsDump(node.attributes)} }, res, true ));\n`;
                }
                //return
                return resp;
            }
        },

        //condicion_view gets called by condicion_script, but we prevent its detection intentionally
        'def_condicion': {
            x_icons: 'help',
            x_level: '>2',
            x_text_contains: 'condicion si',
            x_text_pattern: [
            `condicion si "*" +(es|no es|es menor a|es menor o igual a|es mayor a|es mayor o igual a|es menor que|es menor o igual que|es mayor que|es mayor o igual que|esta entre|contiene registro|contiene|contiene item|contiene llaves|contiene propiedades) "*"`,
            `condicion si "*" no es "*/*"`,
            `condicion si "*" es +(objeto|array|struct|string|texto)`,
            `condicion si "*" es +(numero|entero|int|booleano|boleano|boolean|fecha|date|email)`,
            `condicion si "*" no es +(numero|entero|int|booleano|boleano|boolean|fecha|date|email)`,
            `condicion si "*" +(esta vacia|esta vacio|is empty|existe|exists|no existe|doesnt exist|no es indefinido|no es indefinida|esta definida|no esta vacio|existe|esta definida|no es nula|no es nulo|es nula|not empty)`,
            `condicion si "*" +(no contiene registros|contiene registros)`,
            `condicion si "*" esta entre "*" inclusive`,
            `condicion si falta parametro "*"`,
            ],
            hint:   `Declara que los hijo/s deben cumplir la condicion indicada para ser ejecutados.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state,
                    hasChildren: true
                });
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                //if (resp.state.from_script && resp.state.from_script==true) return {...resp,...{ valid:false }};
                // detect which pattern did the match.
                let match = require('minimatch');
                let which = -1;
                let text_trim = node.text.trim();
                for (let x of context.x_commands['def_condicion'].x_text_pattern) {
                    which+=1;
                    let test = match(text_trim,x);
                    if (test==true) break;
                    await setImmediatePromise(); //@improved
                };

                // extract the values
                let extract = require('extractjs')();
                let defaults = { variable:'', operator:'es', value:'' };
                let patterns = [
                    `condicion si "{variable}" {operator} "{value}"`,
                    `condicion si "{variable}" {operator} "{value}"`,
                    `condicion si "{variable}" {operator}`,
                    `condicion si "{variable}" {operator}`,
                    `condicion si "{variable}" {operator}`,
                    `condicion si "{variable}" {operator}`,
                    `condicion si "{variable}" {operator}`,
                    `condicion si "{variable} esta entre "{value}" inclusive`,
                    `condicion si {operator} "{value}"`,
                ];
                
                let elements = {...defaults,...extract(patterns[which],text_trim)};
                let original_value = elements.value;
                // pre-process elements
                if (typeof elements.variable === 'string' && elements.variable.includes('**') && node.icons.includes('bell')) elements.variable = getTranslatedTextVar(elements.variable);
                if (typeof elements.value === 'string' && elements.value.includes('**') && node.icons.includes('bell')) elements.value = getTranslatedTextVar(elements.value);
                if (typeof elements.variable === 'string' && (elements.variable.includes('$variables.') || 
                    elements.variable.includes('$vars.') ||
                    elements.variable.includes('$params.') ||
                    elements.variable.includes('$store.') ||
                    elements.variable.includes('$route.'))
                    ) {
                } else if (typeof elements.variable === 'string' && elements.variable.charAt(0)=='$') {
                    elements.variable = elements.variable.right(elements.variable.length-1);
                }
                // test for siblings conditions
                elements.type = 'v-if';
                let before_me = await context.dsl_parser.getBrotherNodesIDs({ id:node.id, before:true, after:false, array:true });
                if (before_me.length>0) {
                    if (before_me[0].TEXT && before_me[0].TEXT.includes('condicion si')) {
                        elements.type = 'v-else-if'
                    }
                }
                let escape_value = function(value2) {
                    let value = value2;
                    if (typeof value !== 'undefined') {
                        if ((typeof value === 'string' && isNumeric(value) && value.charAt(0)!='0') ||
                            !isNaN(value) || 
                            (typeof value === 'string' && (value=='true' || value=='false')) ||
                            (typeof value === 'string' && (value.charAt(0)=='$') || value.includes('this.'))
                            ) {
                            //value = value;
                        } else if (original_value.includes('**') && value!=original_value) {
                        } else {
                            value = `'${value}'`;
                        }
                    }
                    return value;
                };
                // tag params
                let params = aliases2params('def_condicion',node);
                params = {...params, ...{
                    target: 'template',
                    tipo: elements.type,
                    operador: elements.operator,
                    valor: elements.value
                }};
                let sons = await node.getNodes();
                if (sons.length==1) params.target=sons[0].id; //.id
                if (params.individual && (params.individual==true || params.individual=='true')) {
                    params.tipo = 'v-if'; elements.type = 'v-if';
                    delete params.individual;
                }
                // get full expression, depending on operator
                if (elements.operator=='idioma es') {
                    params.expresion = `this.$i18n && this.$i18n.locale=='${elements.variable}'`;
                } else if (['es','=','eq'].includes(elements.operator)) {
                    if (elements.value==true && elements.value!=1) {
                        params.expresion = elements.variable;
                    } else if (elements.value==false && elements.value!=0) {
                        params.expresion = '!'+elements.variable;
                    } else if (typeof elements.value === 'string' && (
                        elements.value.includes('$variables.') || 
                        elements.value.includes('$vars.') ||
                        elements.value.includes('$params.') ||
                        elements.value.includes('$store.') ||
                        elements.value.includes('this.')
                    )) {
                        params.expresion = `${elements.variable} == ${elements.value}`;
                    } else if (typeof elements.value === 'number') {
                        params.expresion = `${elements.variable} == ${elements.value}`;
                    } else if (typeof elements.value === 'string' &&
                                elements.value.charAt(0)=='(' && elements.value.right(1)==')') {
                        let temp = elements.value.substr(1,elements.value.length-2);
                        params.expresion = `${elements.variable} == ${temp}`;
                    } else if (typeof elements.value === 'string' &&
                        elements.value.charAt(0)=='$' && elements.value.includes(`$t('`)==false) {
                        let temp = elements.value.right(elements.value.length-1);
                        params.expresion = `${elements.variable} == ${temp}`;
                    } else if (typeof elements.value === 'string' && (elements.value=='true' || elements.value=='false' || isNumeric(elements.value))) {
                        params.expresion = `${elements.variable} == ${elements.value}`;
                    } else {
                        params.expresion = `${elements.variable} == ${escape_value(elements.value)}`;
                    }

                } else if ('es string,es texto,string,texto'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isString(${elements.variable})`;

                } else if ('falta parametro'.split(',').includes(elements.operator)) {
                    if (elements.value=='*') {
                        let func_params = context.x_state.functions[resp.state.current_func].params.split(',');
                        let each_test = [];
                        for (let param of func_params) {
                            if (param.right(1)=='*') {
                                let without_star = param.replaceAll('*','');
                                each_test.push(`(!_.has(params,'${without_star}') || 
                                                  _.isUndefined(params.${without_star}) || 
                                                  _.isNull(params.${without_star})
                                                )`);
                            }
                        }
                        params.expresion = `${each_test.join(' && ')}`;
                        //console.log('PABLO debug falta parametros',func_params);
                    } else {
                        let test = 'params';
                        if (context.x_state.functions[resp.state.current_func].method!='get') {
                            test = 'body';
                        }
                        params.expresion = `(!_.has(req.${test},'${elements.value}') ||
                                            _.isUndefined(req.${test}.${elements.value}) ||
                                            _.isNull(req.${test}.${elements.value})
                                            )`;
                    }

                } else if ('es numero,es int,numero,int'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNumber(${elements.variable})`;

                } else if ('es boolean,es boleano,es booleano,booleano,boleano,boolean'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isBoolean(${elements.variable})`;
                
                } else if ('es fecha,es date,fecha,date'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isDate(${elements.variable})`;
                
                } else if ('es entero,es int,entero,int'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isFinite(${elements.variable})`;
                
                } else if ('es array,array'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isArray(${elements.variable})`;

                } else if ('es struct,struct'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isObject(${elements.variable}) && !_.isArray(${elements.variable}) && !_.isFunction(${elements.variable})`;

                } else if ('es objeto,objeto'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isObject(${elements.variable})`;
                
                } else if ('es correo,es email,email,correo'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isString(${elements.variable}) && /\\S+@\\S+\\.\\S+/.test(${elements.variable})`;

                } else if ('no es correo,no es email'.split(',').includes(elements.operator)) {
                    params.expresion = `!(_.isString(${elements.variable}) && /\\S+@\\S+\\.\\S+/.test(${elements.variable}))`;

                //numeric testings
                } else if ('es menor o igual a,es menor o igual que'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNumber(${elements.variable}) && _.isNumber(${elements.value}) && ${elements.variable} <= ${elements.value}`;
                
                } else if ('es menor a,es menor que'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNumber(${elements.variable}) && _.isNumber(${elements.value}) && ${elements.variable} < ${elements.value}`;

                } else if ('es mayor o igual a,es mayor o igual que'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNumber(${elements.variable}) && _.isNumber(${elements.value}) && ${elements.variable} >= ${elements.value}`;

                } else if ('es mayor a,es mayor que'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNumber(${elements.variable}) && _.isNumber(${elements.value}) && ${elements.variable} > ${elements.value}`;

                } else if ('esta entre'==elements.operator && elements.value.includes(',')) {
                    let from = elements.value.split(',')[0];
                    let until = elements.value.split(',').pop();
                    params.expresion = `${elements.variable} >= ${from} && ${elements.variable} <= ${until}`;

                // strings
                } else if ('no esta vacio,not empty'.split(',').includes(elements.operator)) {
                    params.expresion = `(_.isObject(${elements.variable}) || (_.isString(${elements.variable})) &&  !_.isEmpty(${elements.variable})) || _.isNumber(${elements.variable}) || _.isBoolean(${elements.variable})`;

                } else if ('esta vacio,is empty,esta vacia'.split(',').includes(elements.operator)) {
                    params.expresion = `(_.isObject(${elements.variable}) ||_.isString(${elements.variable})) &&  _.isEmpty(${elements.variable})`;

                // other types
                } else if ('existe,exists,no es indefinido,no es indefinida,esta definida'.split(',').includes(elements.operator)) {
                    params.expresion = `!_.isUndefined(${elements.variable})`;

                } else if ('no existe,doesnt exists,es indefinido,es indefinida,no esta definida'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isUndefined(${elements.variable})`;

                } else if ('no es nula,no es nulo'.split(',').includes(elements.operator)) {
                    params.expresion = `!_.isNull(${elements.variable})`;

                } else if ('es nula,es nulo'.split(',').includes(elements.operator)) {
                    params.expresion = `_.isNull(${elements.variable})`;

                } else if ('no es,!=,neq'.split(',').includes(elements.operator)) {
                    params.expresion = `${elements.variable}!=${escape_value(elements.value)}`;

                // records
                } else if ('no contiene registros,contains no records'.split(',').includes(elements.operator)) {
                    params.expresion = `${elements.variable} && ${elements.variable}.length==0`;

                } else if ('contiene registros,contains records'.split(',').includes(elements.operator)) {
                    params.expresion = `${elements.variable} && ${elements.variable}.length`; //@todo check if this needs to be .length>0

                } else if ('contiene llaves,contiene propiedades'.split(',').includes(elements.operator)) {
                    params.expresion = `_.every( (_.isString(${escape_value(elements.value)}))?${escape_value(elements.value)}.split(','):${escape_value(elements.value)}, _.partial(_.has, ${elements.variable}))==true`;

                } else if ('contiene registro,contiene item'.split(',').includes(elements.operator)) {
                    params.expresion = `_.contains(${elements.variable},${escape_value(elements.value)})`;

                } else if ('contiene,contains'.split(',').includes(elements.operator)) {
                    params.expresion = `(${elements.variable}+'').toLowerCase().indexOf((${escape_value(elements.value)}+'').toLowerCase())!=-1`;

                } else {
                    //operator not defined
                    context.x_console.outT({ message:`Operator (${elements.operator}) not defined in 'condicion si' x_command`, color:'red', data:{elements,params,which} });
                    throw `Operator ${elements.operator} not defined in '${node.text}'`;
                    //params.expresion = `(AQUI VAMOS: ${node.text})`;
                }

                //comments?
                if (node.text_note != '') resp.open += `<!-- ${node.text_note.cleanLines()} -->\n`;
                // prepare expressions
                let expresion_js = params.expresion. replaceAll('$variables.','this.')
                                                    .replaceAll('$vars.','this.')                                   
                                                    .replaceAll('$params.','this.');
                let expresion_view = params.expresion.   replaceAll('$variables.','')
                                                        .replaceAll('$vars.','')
                                                        .replaceAll('$params.','');
                if (state.current_proxy) {
                    expresion_js = expresion_js.replaceAll('$store.','store.state.');
                    expresion_view = expresion_view.replaceAll('$store.','store.state.');
                } else {
                    expresion_js = expresion_js.replaceAll('$store.','this.$store.state.');
                    expresion_view = expresion_view.replaceAll('$store.','$store.state.');
                }
                //resp.state.meta = { if_js:expresion_js, if_view:expresion_view, params, elements };
                //code
                if (node.text_note != '') resp.open = `/* ${node.text_note.cleanLines()} */\n`;
                if (params.tipo=='v-if') {
                    resp.open += `if (${expresion_js}) {\n`;
                } else {
                    resp.open += `else if (${expresion_js}) {\n`;
                }
                resp.close = `}\n`;

                // prepare virtual vars for underscore support
                if (params.expresion && params.expresion.includes('_.')) {
                    context.x_state.functions[resp.state.current_func].imports['underscore'] = '_';
                }
                return resp;
            }
        },

        'def_otra_condicion': {
            x_icons: 'help',
            x_level: '>2',
            x_text_exact: 'otra condicion',
            hint:   `Ejecuta sus hijos en caso de no cumplirse la condicion anterior.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state,
                    hasChildren: true
                });
                //if (!resp.state.from_script || (resp.state.from_script && resp.state.from_script==false)) return {...resp,...{ valid:false }};
                //code
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                resp.open += `else {\n`;
                resp.close = `}\n`;
                return resp;
            }
        },

        //*def_condicion_view
        //*def_otra_condicion_view
        //*def_condicion (def_script_condicion)
        //*def_otra_condicion (def_script_otra_condicion)

        // *************************
        //  Scriptable definitions
        // *************************

        //..scripts..

        'def_struct': {
            x_icons: 'desktop_new',
            x_text_contains: 'struct,,',
            x_not_text_contains: 'traducir',
            x_level: '>3',
            hint: 'Crea una variable de tipo Objeto, con los campos y valores definidos en sus atributos.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = {};
                // parse output var
                tmp.var = node.text.split(',').pop().trim(); //last comma element
                if (resp.state.from_server) { // if (context.hasParentID(node.id, 'def_event_server')==true) {
                    tmp.var = tmp.var.replaceAll('$variables.', 'resp.')
                        .replaceAll('$vars.', 'resp.')
                        .replaceAll('$params.', 'resp.');
                    tmp.var = (tmp.var == 'resp.') ? 'resp' : tmp.var;
                    tmp.parent_server = true;
                } else {
                    tmp.var = tmp.var.replaceAll('$variables.', 'this.');
                    tmp.var = (tmp.var == 'this.') ? 'this' : tmp.var;
                }
                // process attributes
                let attrs = {...node.attributes
                };
                Object.keys(node.attributes).map(function(key) {
                    let keytest = key.toLowerCase().trim();
                    let value = node.attributes[key].trim();
                    if (node.icons.includes('bell') && value.includes('**')) {
                        value = getTranslatedTextVar(value,true);
                    } else {
                        // normalize vue type vars
                        if (tmp.parent_server==true) {
                            value = value.replaceAll('$variables.', 'resp.')
                                .replaceAll('$vars.', 'resp.')
                                .replaceAll('$params.', 'resp.');
                        } else {
                            value = value.replaceAll('$variables.', 'this.')
                                .replaceAll('$config.', 'process.env.');
                        }
                    }
                    attrs[key] = value; //.replaceAll('{now}','new Date()');
                });
                // write output
                if (resp.state.as_object) {
                    resp.state.object = attrs;
                    resp.open = context.jsDump(attrs).replaceAll("'`","`").replaceAll("`'","`");
                    delete resp.state.as_object;
                } else {
                    if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                    resp.open += `var ${tmp.var.trim()} = ${context.jsDump(attrs).replaceAll("'`","`").replaceAll("`'","`")};\n`;
                }
                return resp;
            }
        },

        'def_extender': {
            x_level: '>3',
            x_text_contains: `extender "`,
            x_icons: 'desktop_new',
            hint: 'Extiende los atributos de un objeto con los datos dados en los atributos.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                // create obj from current node as js obj
                let obj = await context.x_commands['def_struct'].func(node, { ...state, ...{
                    as_object:true
                }});
                // get var name
                let tmp = {};
                tmp.var = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: '"',
                    symbol_closing: '"'
                }).trim();
                // clean given varname $variables, etc.
                tmp.var = tmp.var.replaceAll('$variables.', 'this.').replaceAll('store.', 'this.$store.state.');
                tmp.var = (tmp.var == 'this.') ? 'this' : tmp.var;
                // extend given var with 'extend_node' content
                // support attr = !attr - 13may21
                for (let x in obj.state.object) {
                    if (obj.state.object[x].charAt(0)=='!' &&
                        obj.state.object[x].includes('this.')==false) {
                            obj.state.object[x] = obj.state.object[x].replaceAll('!',`!${tmp.var}.`);
                    }
                }
                tmp.nobj = context.jsDump(obj.state.object);
                //underscore
                /* @todo add to npm 
                if (state.current_page) {
                    context.x_state.pages[resp.state.current_page].imports['underscore'] = '_';
                } else if (state.current_proxy) {
                    context.x_state.proxies[resp.state.current_proxy].imports['underscore'] = '_';
                } else if (state.current_store) {
                    context.x_state.stores[resp.state.current_store].imports['underscore'] = '_';
                }*/
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                //resp.open = `${tmp.var} = {...${tmp.var},...${tmp.nobj}};\n`;
                resp.open += `${tmp.var} = _.extend(${tmp.var}, ${tmp.nobj});\n`;
                return resp;
            }
        },

        'def_literal_js': {
            x_icons: 'penguin',
            x_not_text_contains: 'por cada registro en',
            x_level: '>1',
            hint: 'Nodo JS literal; solo traduce $variables y referencias de refrescos a metodos async.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { text:node.text };
                tmp.text = tmp.text .replaceAll('$variables.','this.')
                                    .replaceAll('$config.','process.env.');
                //code
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                resp.open += tmp.text;
                if (resp.open.right(1)!=';') resp.open += ';';
                resp.open += '\n';
                return resp;
            }
        },

        'def_console': {
            x_icons: 'clanbomber',
            x_not_icons: 'desktop_new',
            x_level: '>1',
            x_watch: `x_state.central_config.log`,
            hint: 'Emite su texto a la consola. Soporta mostrar los datos/variables de sus atributos.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { text:node.text };
                if (node.icons.includes('bell')) {
                    tmp.text = getTranslatedTextVar(tmp.text);
                } else {
                    tmp.text = '`'+tmp.text+'`';
                }
                //attr
                // process attributes
                let attrs = {...node.attributes
                };
                Object.keys(node.attributes).map(function(key) {
                    let keytest = key.toLowerCase().trim();
                    let value = node.attributes[key].trim();
                    let valuet = getTranslatedTextVar(value);
                    // normalize vue type vars                        
                    value = value.replaceAll('$variables.', 'this.');
                    //bell
                    if (node.icons.includes('bell') && value.replaceAll('**','')!=valuet) { // && value!=`**${valuet}**`) {
                        value = getTranslatedTextVar(value);
                    } else if (!node.icons.includes('bell') && value.includes('**')) {
                        value = `'${value}'`;
                    }
                    // modify values to copy
                    attrs[key] = value;
                });
                //code
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                if (context.x_state.central_config.log && context.x_state.central_config.log=='none') {
                    resp.open += `//console-none:${tmp.text}\n`;
                } else {
                    resp.open += `console.log(${tmp.text},${context.jsDump(attrs)});\n`;
                }
                return resp;
            }
        },

        'def_npm_instalar': {
            x_icons: 'desktop_new',
            x_text_contains: `npm:instal,",,`,
            //x_text_pattern: [`npm:+(install|instalar) "*"`,`npm:+(install|instalar) "*",*`],
            x_level: '>2',
            hint: 'Instala el paquete npm indicado entrecomillas y lo instancia en la página (import:true) o función actual, o lo asigna a la variable indicada luego de la coma.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let defaults = { text:node.text, tipo:'import', tipo_:'', version:'*', git:'', init:'', var:'' };
                let attr = aliases2params('def_npm_instalar', node);  
                attr = {...defaults, ...attr};
                let extract = require('extractjs')();
                let elements = extract(`npm:{cmd} "{package}", {var}`,node.text);
                if (attr.import && (attr.import!='true' || attr.import!=true)) attr.tipo_ = attr.import;
                attr.text = elements.package.trim();
                attr.var = attr.tipo_ = elements.var.trim();
                //code
                context.x_state.npm[attr.text] = attr.version;
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                if (!attr.require && attr.var=='') {
                    if ('current_func' in resp.state) {
                        context.x_state.functions[resp.state.current_func].imports[attr.text] = attr.tipo_;
                    }
                } else {
                    resp.open += `let ${attr.var} = require('${attr.text}');\n`;
                }
                return resp;
            }
        },

        'def_crear_id_unico': {
            x_icons: 'desktop_new',
            x_text_contains: 'crear id unico,,', //,,=requires comma
            x_level: '>2',
            hint: 'Obtiene un id unico (en 103 trillones) y lo asigna a la variable luego de la coma.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.text.split(',').pop() };
                //code
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                context.x_state.npm['nanoid']='2.1.1';
                resp.open += `let ${tmp.var} = require('nanoid')();\n`;
                return resp;
            }
        },

        'def_aftertime': {
            x_icons: 'desktop_new',
            x_text_pattern: `ejecutar en "*" +(segundos|minutos|horas)`,
            x_level: '>2',
            hint: 'Ejecuta su contenido desfasado en los segundos especificados.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let time = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //code
                let amount = node.text.split(' ').pop();
                if (amount=='minutos') time += `*60`;
                if (amount=='horas') time += `*60*60`;
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                resp.open += `setTimeout(function q() {\n`;
                resp.close = `}.bind(this), 1000*${time});\n`;
                return resp;
            }
        },

        'def_probar': {
            x_icons: 'broken-line',
            x_text_exact: 'probar',
            x_level: '>2',
            hint: 'Encapsula sus hijos en un try/catch.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //test if there is an error node child
                let subnodes = await node.getNodes();
                let has_error = false, error_index=-1;
                subnodes.map(async function(item, index) {
                    if (item.text=='error' && item.icons.includes('help')) {
                        error_index=index;
                        has_error=true;
                    }
                }.bind(this));
                //code
                resp.state.error_asvar=false;
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                if (error_index!=subnodes.length-1) {
                    //this means the error child is not the last node
                    resp.state.error_asvar=true;
                    resp.state.error_var=node.id+'_trycatch.error';
                    resp.open += `var ${node.id}_trycatch = { error:function(e) { console.log('error en comando probar: recuerda usar evento ?error como hijo para controlarlo.',e); } };\n`;
                }
                resp.open += 'try {\n';
                if (has_error==false && !resp.state.error_asvar) {
                    resp.close += `} catch(e${node.id}) {\n console.log('error en comando probar: recuerda usar evento ?error como hijo para controlarlo.');\n`;
                } else if (resp.state.error_asvar==true) {
                    resp.close += `} catch(e${node.id}) {\n ${resp.state.error_var}(e${node.id});\n`;
                }
                resp.close += '}';
                return resp;
            }
        },

        'def_probar_error': {
            x_icons: 'help',
            x_text_exact: 'error',
            x_all_hasparent: 'def_probar',
            x_level: '>2',
            hint: 'Ejecuta sus hijos si ocurre un error en el nodo padre.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //code
                if (resp.state.error_asvar && resp.state.error_asvar==true) {
                    if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                    resp.open += `${resp.state.error_var} = function(evento) {\n`;
                    resp.close += `};\n`;
                } else {
                    resp.open += `} catch(e${node.id}) {\n`;
                    resp.open += `let error = e${node.id};\n`;
                    if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                }
                return resp;
            }
        },

        'def_consultar_modelo': {
            x_icons: 'desktop_new',
            x_text_contains: `consultar modelo "`,
            x_level: '>2',
            hint:  `Realiza una consulta a la base de datos.
                    Sus atributos corresponden a los campos y datos a filtrar.
                    Se asigna el resultado a la variable luego de la coma.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id+'_', data:{}, model:'', use_var:false, cache:0 };
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.model = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //parse model name: folder/model -> camel(folder)_camel(model)
                // model -> findFolder(model) -> camel(folder)_camel(model)
                let ccase = require('fast-case');
                let getRealModel = function(model) {
                    let ccase = require('fast-case');
                    let tmp={ model:model };
                    if (tmp.model.includes('/')) {
                        tmp.model_folder = tmp.model.split('/')[0].trim();
                        tmp.model = tmp.model.split('/')[1].trim();
                        tmp.model = ccase.camelize(tmp.model_folder)+'_'+ccase.camelize(tmp.model);                    
                    } else {
                        //search model folder if any, and not defined within node.text
                        for (let table in context.x_state.models.tables) {
                            if (table.includes('/') && ccase.camelize(table.split('/')[1].trim())==ccase.camelize(tmp.model.trim())) {
                                tmp.model_folder = table.split('/')[0];
                                break;
                            }
                        }
                        if (tmp.model_folder) {
                            tmp.model = ccase.camelize(tmp.model_folder)+'_'+ccase.camelize(tmp.model.trim());
                        }
                    }
                    return tmp.model;
                };
                if (tmp.model!='') {
                    tmp.model = getRealModel(tmp.model);
                    context.x_state.functions[resp.state.current_func].used_models[tmp.model]='';
                }
                //attributes
                tmp.info = { _fields:[], _order:[], _join:{}, _where:{}, _group:[] };
                let extract = require('extractjs')();
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                let escapeKeyVars = function(text) {
                    let resp = text;
                    let changes = {
                        '{now}': 'new Date()'
                    };
                    Object.keys(changes).map(function(key) {
                        if (typeof resp == 'string') {
                            resp = resp.replaceAll(key,changes[key]);
                        }
                    });
                    return resp;
                };
                //process attributes
                Object.keys(node.attributes).map(function(keym) {
                    let key = keym.toLowerCase();
                    let value = node.attributes[keym];
                    // fields attr
                    if ([':fields', ':campos'].includes(key)) {
                        if (value.includes(':unicos') || value.includes(':sum')) {
                            let fields = value.split(',');
                            for (let field_x in fields) {
                                let field = fields[field_x]; 
                                if (field.includes(':unicos')==true) {
                                    let name = field.split(':')[0];
                                    tmp.info._fields.push(`[Sequelize.fn('DISTINCT', Sequelize.col('${name}')), '${name}']`);
                                } else if (field.includes(':sumar')==true) {
                                    let name = field.split(':')[0];
                                    tmp.info._fields.push(`[Sequelize.fn('sum', Sequelize.col('${name}')), '${name}']`);
                                } else if (field.includes(':agrupar')==true) {
                                    let name = field.split(':')[0];
                                    tmp.info._group.push(name);
                                    tmp.info._fields.push(name);
                                } else {
                                    tmp.info._fields.push(field);
                                }
                            }
                        } else {
                            tmp.info._fields = value.split(',');
                        }
                    //
                    } else if (key==':var') {
                        tmp.use_var=true;
                    } else if (key==':cache') {
                        tmp.cache = parsedHuman(value)/1000;
                    //order by attr
                    } else if (['order by', '_order by', '_orderby',':orderby',':order by'].includes(key)) {
                        let order = value.split(' ');
                        if (value.includes('.')==true) {
                            // table.field asc/desc
                            let model = value.split('.')[0];
                            let field = value.split(' ')[0].split('.').pop();
                            let direction = order[1].toUpperCase();
                            tmp.info._order.push(model);
                            tmp.info._order.push(`'${field}'`);
                            tmp.info._order.push(`'${direction}'`);
                        } else {
                            // field asc/desc
                            tmp.info._order.push(order[0].trim());
                            tmp.info._order.push(order[1].trim().toUpperCase());
                        }
                    //join -> idusuario=usuarios.id -> model:usuario, where 'id = idusuario'
                    } else if ([':join', ':integrar', ':unir'].includes(key)) {
                        let elements = extract(`{field}={model}.{model_field}`,value);
                        if (elements.model) {
                            elements.model = getRealModel(elements.model);
                            tmp.info._join[elements.model] = { field:elements.field, external_field:elements.model_field };
                            //tmp.info._join = { [elements.field]:{ model:elements.model, field:elements.model_field } };
                            context.x_state.functions[resp.state.current_func].used_models[elements.model]='';
                        }

                    } else if (['_limit', '_limitar', '_limite', '_max', ':limitar', ':limite', ':max', ':limit'].includes(key)) {
                        if (node.icons.includes('bell') && value.includes('**')) {
                            tmp.info._limit = getTranslatedTextVar(value,true);    
                        } else if (isNumeric(value)) {
                            tmp.info._limit = parseFloat(value);
                        } else {
                            tmp.info._limit = escapeKeyVars(value);
                        }                        

                    } else {
                        // where field...
                        //fecha_vencimiento: { [Sequelize.Op.lt]: new Date() } },
                        let type = 'String', value_bak = value;
                        let var_operator = '';
                        if (isNumeric(value)) {
                            type = 'Integer';
                            value = parseFloat(value);
                        } else if (typeof value=='string' && value.includes(',') && value.includes(`(`)==false && value.includes(`)`)==false) {
                            type = 'Array';
                            value = value.split(',');
                        } else if (typeof value=='string' && value.includes('**') && node.icons.includes('bell')) {
                            type = 'var';
                            if ('<,>,='.includes(value.charAt(0))) {
                                var_operator = value.charAt(0);
                                value = value.substr(1,value.length-1);
                                if (value.charAt(0)=='=') {
                                    // gte / lte
                                    var_operator += '=';
                                    value = value.substr(1,value.length-1);
                                }
                            }
                            value = getTranslatedTextVar(value,true);
                        }
                        if (key.includes(':')) { //typeof value=='string' && 
                            // x:{operator}=value
                            let elements = extract(`{field}:{operator}`,keym);
                            if (elements.operator) {
                                if (elements.operator=='in') {
                                    tmp.info._where[elements.field] = { '[Sequelize.Op.in]':value };
                                } else if (elements.operator=='not') {
                                    tmp.info.i_not=true;
                                }
                            }
                        } else if (typeof value == 'string' && ('<,>,='.includes(value.charAt(0))==true) || var_operator!=''){
                            // x=>value, x=<value, x=value
                            let operator = value.charAt(0);
                            if (var_operator!='') {
                                operator = var_operator;
                            } else {
                                value = value.substr(1,value.length-1);
                                if (value.charAt(0)=='=') {
                                    // gte / lte
                                    operator += '=';
                                    value = value.substr(1,value.length-1);
                                }
                            }
                                /*if (value.charAt(0)=='`') {
                                operator = value.replaceAll('`','').charAt(0);
                                value = value.replace('`'+operator,'`');
                            } else {
                                value = value.substr(1,value.length-1);
                            }*/
                            if (operator=='<=') {
                                tmp.info._where[keym] = { '[Sequelize.Op.lte]':escapeKeyVars(value) };
                            } else if (operator=='>=') {
                                tmp.info._where[keym] = { '[Sequelize.Op.gte]':escapeKeyVars(value) };
                            } else if (operator=='<') {
                                tmp.info._where[keym] = { '[Sequelize.Op.lt]':escapeKeyVars(value) };
                            } else if (operator=='>') {
                                tmp.info._where[keym] = { '[Sequelize.Op.gt]':escapeKeyVars(value) };                                

                            } else {
                                tmp.info._where[keym] = value;
                            }
                            
                        } else if (typeof value == 'string' && (value.charAt(0)=='*' || value.split('').splice(-1).join()=='*') && value.includes('**')==false) {
                            // x=*value, x=value*
                            value = value_bak.replaceAll('**','||');
                            value = `'`+value.replaceAll('*','%').replaceAll('||','**')+`'`;
                            if (tmp.info.i_not) {
                                tmp.info._where['[Sequelize.Op.not]'] = [{ [key]:{ '[Sequelize.Op.like]':escapeKeyVars(value) } }];
                            } else {
                                tmp.info._where[keym] = { '[Sequelize.Op.like]':escapeKeyVars(value) };
                            }
                        } else {
                            // x=value
                            tmp.info._where[keym] = escapeKeyVars(value);
                        }
                    }

                });
                //build object
                let obj = { where:tmp.info._where, tableHint: 'Sequelize.TableHints.NOLOCK' };
                if (tmp.info._order.length>0) obj.order=[tmp.info._order];
                if (tmp.info._fields.length>0) obj.attributes=tmp.info._fields;
                if (tmp.info._group.length>0) obj.group=tmp.info._group;
                if (tmp.info._limit) obj.limit=tmp.info._limit;
                //add join info
                for (let model in tmp.info._join) {
                    if (!obj.include) obj.include=[];
                    obj.include.push({
                        model:`**${model}**`,
                        //where: [`${tmp.info._join[model].external_field} = ${tmp.info._join[model].field}`]
                    });
                }
                //serialize data
                let data = context.jsDump(obj,'Sequelize.');
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                //add belongsTo and hasMany for each join
                for (let model in tmp.info._join) {
                    resp.open += `${tmp.model}.belongsTo(${model}, ${context.jsDump({
                        foreignKey: tmp.info._join[model].field
                    })});\n`;
                    resp.open += `${model}.hasMany(${tmp.model}, ${context.jsDump({
                        foreignKey: tmp.info._join[model].field
                    })});\n`;
                }
                // findAll code
                if (tmp.use_var==true) {
                    resp.open += 'var ';
                } else {
                    resp.open += 'let ';
                }
                if (tmp.cache!=0) {                    
                    resp.open += `${tmp.var} = cache.get(object_hash(${data}));\n`;
                    resp.open += `if (!${tmp.var}) {\n`;
                    resp.open += `  ${tmp.var} = await ${tmp.model}.findAll(${data}, { raw:true });\n`;
                    resp.open += `  cache.set(object_hash(${data}),${tmp.var},${tmp.cache});\n`;
                    resp.open += `}\n`;
                } else {
                    resp.open += `${tmp.var} = await ${tmp.model}.findAll(${data}, { raw:true });\n`;
                }
                //resp.open += `let ${node.id}_where = ${context.jsDump(tmp.info._where,'Sequelize.')};\n`; //where for modificar/eliminar commands.
                //console.log('PABLO debug consultar modelo',data);
                resp.state.meta = tmp.info;
                resp.state.model = tmp.model;
                return resp;
            }
        },

        'def_modificar_modelo': {
            x_icons: 'desktop_new',
            x_text_exact: `modificar modelo`,
            //x_not_empty: 'link',
            x_level: '>2',
            hint:  `Modifica los datos de la consulta de modelo enlazada, aplicando los datos definidos en sus atributos.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state,
                    hasChildren:false
                });
                let tmp = { data:{}, model:'' };
                //if (node.link=='') return {...resp,...{ valid:false }};
                //get target node
                let link_node = null;
                if (node.link!='') { 
                    link_node = await context.dsl_parser.getNode({ id:node.link, recurse:false });
                } else if (node.nodes_raw && node.nodes_raw.length > 0) {
                    let subnodes = await node.getNodes();
                    link_node = subnodes[0];
                } else {
                    return {...resp,...{ valid:false }};
                }
                if (link_node && link_node.valid==true) {
                    if (link_node.text.includes('consultar modelo')==false) {
                        if (node.nodes_raw && node.nodes_raw.length > 0) {
                            throw `modificar modelo requires a 'consultar modelo' child node`
                        } else {
                            throw `modificar modelo requires an arrow pointing to a 'consultar modelo' node`
                        }
                    } else {
                        tmp.where = (await context.x_commands['def_consultar_modelo'].func(link_node, { ...state, ...{
                            meta:true
                        }})).state;
                        tmp.model = tmp.where.model;
                        tmp.where = tmp.where.meta._where;
                        tmp.new = (await context.x_commands['def_consultar_modelo'].func(node, { ...state, ...{
                            meta:true
                        }})).state.meta._where;
                        //code
                        if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                        //write update statement
                        resp.open += `await ${tmp.model}.update(${context.jsDump(tmp.new)},{ where:${context.jsDump(tmp.where)} });\n`;
                    }
                } else {
                    throw 'modificar modelo requires an arrow pointing to an active consultar modelo node (cannot be cancelled)'
                }            
                //
                return resp;
            }
        },

        'def_eliminar_modelo': {
            x_icons: 'desktop_new',
            x_text_exact: `eliminar modelo`,
            x_not_empty: 'link',
            x_level: '>2',
            hint:  `Elimina los datos de la consulta de modelo enlazada.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state,
                    hasChildren:false
                });
                let tmp = { model:'' };
                //if (node.link=='') return {...resp,...{ valid:false }};
                //get target node
                let link_node = null;
                if (node.link!='') { 
                    link_node = await context.dsl_parser.getNode({ id:node.link, recurse:false });
                } else if (node.nodes_raw && node.nodes_raw.length > 0) {
                    let subnodes = await node.getNodes();
                    link_node = subnodes[0];
                } else {
                    return {...resp,...{ valid:false }};
                }
                if (link_node && link_node.valid==true) {
                    if (link_node.text.includes('consultar modelo')==false) {
                        if (node.nodes_raw && node.nodes_raw.length > 0) {
                            throw `eliminar modelo requires a 'consultar modelo' child node`
                        } else {
                            throw `eliminar modelo requires an arrow pointing to a 'consultar modelo' node; current link points to node (${node.link}): ${link_node.text}`;
                        }
                    } else {
                        //get linked info
                        tmp.where = (await context.x_commands['def_consultar_modelo'].func(link_node, { ...state, ...{
                            meta:true
                        }})).state;
                        tmp.model = tmp.where.model;
                        tmp.where = tmp.where.meta._where;
                        //code
                        if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                        resp.open += `await ${tmp.model}.destroy({ where:${context.jsDump(tmp.where)} });\n`;
                    }
                } else {
                    throw `eliminar modelo requires an arrow pointing to an active 'consultar modelo' node (cannot be cancelled)`
                }            
                //
                return resp;
            }
        },

        'def_insertar_modelo': {
            x_icons: 'desktop_new',
            x_text_pattern: [`insertar modelo "*"`,`insertar modelo "**",*`,
                             `insertar modelo "*/*"`,`insertar modelo "*/*",*`],
            x_level: '>2',
            hint:  `Inserta los atributos (campos) y sus valores en el modelo indicado entrecomillas. 
                    Si especifica una variable luego de la coma, asigna el resultado de la nueva insercion en esa variable.`,
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id, data:{}, model:'' };
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                //get attributes and values as struct
                tmp.data = (await context.x_commands['def_consultar_modelo'].func(node, { ...state, ...{
                    meta:true
                }})).state;
                tmp.model = tmp.data.model;
                tmp.data = tmp.data.meta._where;
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                //<cfset resp.open=resp.open & "await #tmp.model#.create(" & SerializeParams(pp,tmp.usa_vars) & ").then(async function(#arguments.node.id#) {" & this.nl>
                resp.open += `await ${tmp.model}.create(${context.jsDump(tmp.data)}).then(async function(${tmp.var}) {`;
                resp.close += `});`;
                return resp;
            }
        },

        'def_geo_velocidad': {
            x_icons: 'desktop_new',
            x_text_contains: 'geo:velocidad,,',
            x_level: '>3',
            attributes_aliases: {
                'latitude':     'lat,lat1',
                'longitude':    'lon,lng,lon1,lng1',
                'time':         'tiempo1,time1',
                'latitude2':    'lat2',
                'longitude2':   'lon2,lng2',
                'time2':        'tiempo2,time2',
                'tipo':         'unit,unidad,:type,:tipo,tipo,type'                
            },
            hint: 'Calcula la velocidad a la que realizo un desplazamiento entre lat1,lon1,tiempo1 y lat2,lon2,tiempo2, en km/h y lo asigna en la variable indicada.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id, e_method:'', e_close:'' };
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                let attr = aliases2params('def_geo_velocidad', node, false, 'this.');
                if (attr.tipo!='mts') {
                    tmp.e_method = 'geolib.convertSpeed(';
                    tmp.e_close = `),'${attr.tipo}'`;
                }
                // install plugin.
                context.x_state.npm['geolib'] = "*";
                // code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `let geolib = require('geolib');\n`;
                resp.open += `var ${tmp.var} = ${tmp.e_method}geolib.getSpeed(${context.jsDump({
                    latitude:attr.latitude,
                    longitude:attr.longitude,
                    time:attr.time
                })},${context.jsDump({
                    latitude:attr.latitude2,
                    longitude:attr.longitude2,
                    time:attr.time2
                })}${tmp.e_close});\n`;
                return resp;
            }
        },

        'def_subir_s3': {
            x_icons: 'desktop_new',
            x_text_pattern: [`archivar "*",*`,`s3:guardar "*",*`,`s3:subir "*",*`],
            x_level: '>3',
            attributes_aliases: {
                'file':         'nombre,filename,name,file,archivo',
                'content':      'content,contenido'                
            },
            x_watch: `x_state.central_config.deploy`,
            hint: 'Crea un archivo en el bucket S3 indicado, con los contenidos de sus atributos. Retorna objeto de S3, con Location si exitoso.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id };
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.bucket = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                node.attributes = aliases2params('def_subir_s3', node, false, 'this.');
                let obj = await context.x_commands['def_struct'].func(node, { ...state, ...{
                    as_object:true
                }});
                obj = obj.state.object;
                //install packages.
                context.x_state.npm['aws-sdk'] = '*';
                //@todo check if this output from cfc is needed 2-jun21
                //this.yml[bucket]='s3'
                //this.recursos.cloud='AWS,'+bucket
                //this.recursos.bucketname=bucket
                //code.
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (typeof context.x_state.central_config.deploy=='string' && 
                    (context.x_state.central_config.deploy.includes('eb:') || context.x_state.central_config.deploy=='local')) {
                    //resp.open += `let ${tmp.var}_ = await AWS_s3.upload({ Body:${obj.content}, Bucket:${tmp.bucket}, Key:${obj.file}, ACL:'public-read' }).promise();\n`;
                    resp.open += `let ${tmp.var}_ = await AWS_s3.upload(${context.jsDump({
                        Body:obj.content,
                        Bucket:tmp.bucket,
                        Key:obj.file,
                        ACL:'public-read'
                   })}).promise();\n`;
                } else {
                    let dummy = obj.file;
                    if (node.icons.includes('bell') && dummy.includes('**')) {
                        dummy = getTranslatedTextVar(dummy,false);
                    } else if (dummy.includes('${')) {
                    } else {
                        dummy = `'${obj.file}'`;                        
                    }
                    resp.open += `console.log('aws s3 dummy upload call for '+${dummy}+'; you need to use deploy:eb to make this code real.');`;
                    resp.open += `let ${tmp.var}_ = { Location:'dummy call' }`;
                }
                resp.open += `var ${tmp.var} = ${tmp.var}_.Location\n`;
                return resp;
            }
        },

        'def_eliminar_s3': {
            x_icons: 'desktop_new',
            x_text_pattern: [`eliminar s3 "*"`,`s3:eliminar "*"`],
            x_level: '>3',
            attributes_aliases: {
                'file':         'nombre,filename,name,file,archivo'
            },
            x_watch: `x_state.central_config.deploy`,
            hint: 'Elimina un archivo en el bucket S3 indicado.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id };
                tmp.bucket = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                node.attributes = aliases2params('def_eliminar_s3', node, false, 'this.');
                let obj = await context.x_commands['def_struct'].func(node, { ...state, ...{
                    as_object:true
                }});
                obj = obj.state.object;
                //install packages.
                context.x_state.npm['aws-sdk'] = '*';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (typeof context.x_state.central_config.deploy=='string' && 
                    (context.x_state.central_config.deploy.includes('eb:') || context.x_state.central_config.deploy=='local')) {
                    //resp.open += `let ${tmp.var}_ = await AWS_s3.upload({ Body:${obj.content}, Bucket:${tmp.bucket}, Key:${obj.file}, ACL:'public-read' }).promise();\n`;
                    resp.open += `await AWS_s3.deleteObject(${context.jsDump({
                        Bucket:tmp.bucket,
                        Key:obj.file
                   })}).promise();\n`;
                } else {
                    let dummy = obj.file;
                    if (node.icons.includes('bell') && dummy.includes('**')) {
                        dummy = getTranslatedTextVar(dummy,false);
                    } else if (dummy.includes('${')) {
                    } else {
                        dummy = `'${obj.file}'`;                        
                    }
                    resp.open += `console.log('aws s3 dummy delete call for '+${dummy}+'; you need to use deploy:eb to make this code real.');`;
                }
                return resp;
            }
        },

        'def_convertir_binario': {
            x_icons: 'desktop_new',
            x_text_pattern: [`convertir en binario "*",*`],
            x_level: '>3',
            hint: 'Convierte una variable base64 en un buffer binario, y lo deja en la variable dada.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id };
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.source = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                if (tmp.source.includes('**')==true && node.icons.includes('bell')) {
                    tmp.source = getTranslatedTextVar(tmp.source);
                } else {
                    tmp.source = `'${tmp.source}'`;
                }
                //code
                context.x_state.npm['data-uri-to-buffer'] = '3.0.1';
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `let ${tmp.var} = require('data-uri-to-buffer')(${tmp.source});`;
                return resp;
            }
        },

        'def_tipo_binario': {
            x_icons: 'desktop_new',
            x_text_pattern: [`tipo de binario "*",*`,`detectar tipo de binario "*",*`],
            x_level: '>3',
            hint: 'Detecta el tipo de variable binaria dada, y responde una struct con los campos: ext y mimetype.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id };
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.source = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                if (tmp.source.includes('**')==true && node.icons.includes('bell')) {
                    tmp.source = getTranslatedTextVar(tmp.source);
                } else {
                    tmp.source = `'${tmp.source}'`;
                }
                //code
                context.x_state.npm['file-type'] = '16.5.3';
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `let ${tmp.var}_type = require('file-type');\n`;
                resp.open += `let ${tmp.var} = await ${tmp.var}_type.fromBuffer(${tmp.source});`;
                return resp;
            }
        },

        'def_async_parallel': {
            x_icons: 'desktop_new',
            x_text_contains: 'paralelo,,',
            x_level: '>3',
            hint: 'Representa la ejecución paralela de sus nodos hijos como funciones independientes, y la recolección total de sus resultados en una sola variable definida luego de una coma.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let tmp = { var:node.id };
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                // build child nodes
                resp.state.parallel = `${node.id}_funcs`;
                resp.open += `let ${resp.state.parallel} = [];\n`;
                resp.close += `let ${node.id}_ = await Promise.all(${resp.state.parallel});\n`;
                if (tmp.var.includes('.')==false) resp.close += `let `;
                resp.close += `${tmp.var} = {};\n`;
                //write responses
                let sons = await node.getNodes(), count=0;
                for (let x of sons) {
                    if (x.valid && x.valid==true) {
                        resp.close += `${tmp.var}.${x.text.trim()} = ${node.id}_[${count}];\n`;
                        count+=1;
                    }
                }
                resp.close += ``;
                return resp;
            }
        },

        'def_async_parallel_son': {
            x_icons: 'xmag',
            x_all_hasparent: 'def_async_parallel',
            x_level: '>3',
            hint: 'Hijo de un nodo paralelo, entrega la ejecución de su hijo en el nombre del nodo.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //code
                //context.x_state.functions[resp.state.current_func].used_models[tmp.model]
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                let used_models = Object.keys(context.x_state.functions[resp.state.current_func].used_models);
                resp.open += `${resp.state.parallel}.push(`;
                if (used_models.length>0) {
                    resp.open += `async function(params,${used_models.join(',')}) {\n`;
                    resp.close += `}(params,${used_models.join(',')})`;
                } else {
                    resp.open += `async function(params) {\n`;
                    resp.close += `}(params)`;
                }
                resp.close += `);\n`;
                resp.state.name = node.text.trim();
                return resp;
            }
        },

        'def_async_parallel_responder': {
            x_icons: 'desktop_new',
            x_text_contains: `responder "`,
            x_or_hasparent: 'def_async_parallel_son',
            x_level: '>3',
            hint: 'Emite una respuesta para una funcion dentro de un nodo parallel.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                if (node.text_note != '') resp.open = `// ${node.text_note.cleanLines()}\n`;
                let text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                });
                // tests return types
                if (text.includes('**') && node.icons.includes('bell')) {
                    let new_vars = getTranslatedTextVar(text);
                    resp.open += `return ${new_vars};\n`;
                } else if (text.includes('$')) {
                    text = text.replaceAll('$params.', 'this.')
                        .replaceAll('$variables.', 'this.');
                    resp.open += `return ${text};\n`;
                /*} else if (text.includes('assets:')) {
                    text = context.getAsset(text, 'js');
                    resp.open += `return ${text};\n`;*/
                } else if (text == '') {
                    resp.open += `return '';\n`;
                } else if (text.charAt(0) == '(' && text.slice(-1) == ')') {
                    text = text.slice(1).slice(0, -1);
                    resp.open += `return ${text};\n`;
                } else {
                    resp.open += `return '${text}';\n`;
                }
                return resp;
            }
        },

        //def_consultar_web
        'def_consultar_web': {
            x_icons: 'desktop_new',
            x_text_contains: 'consultar web,,',
            x_level: '>3',
            attributes_aliases: {
                ':method':           '_method,:metodo,:method,_metodo',
                ':responseType':     'responsetype,response,:responsetype,:response',
                ':responseEncoding': ':encoding'
            },
            hint: 'Realiza una llamada a la url indicada enviando los datos definidos en sus atributos. Entrega resultados en variable definida luego de coma.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let config = { headers:{} }, data = {}, tmp = { simple:true, method:'get', cache:0 };
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                // prepare attrs
                let attrs = aliases2params('def_consultar_web', node, false, 'this.',true);
                delete attrs.refx;
                Object.keys(attrs).map(function(key) {
                    if (attrs[key].includes('**') && node.icons.includes('bell')) {
                        attrs[key] = getTranslatedTextVar(attrs[key],true);
                    }
                    //
                    if (key.charAt(0)==':') {
                        let wd = key.right(key.length-1);
                        if (wd=='cache') {
                            tmp.cache = tmp.cache = parsedHuman(attrs[key])/1000;
                        } else {
                            config[wd] = attrs[key];
                        }
                    } else if (key.length>2 && key.substr(0,3)=='x-:') {
                        config.headers[key.right(key.length-3)] = attrs[key];
                    } else if (key.length>2 && key.substr(0,2)=='x-') {
                        config.headers[key] = attrs[key];
                    } else {
                        data[key] = attrs[key];
                    }
                });
                if (config.headers=={}) delete config.headers;
                if (node.link!='') config.url = node.link.trim();
                // data mapping
                if (config.username) {
                    if (!config.auth) config.auth={};
                    config.auth.username = config.username;
                    config.auth.password = config.password;
                    delete config.username;
                    delete config.password;
                }
                if (config.method.toLowerCase()=='postjson') config.method = 'post';
                if (config.meta) {
                    tmp.meta = config.meta;
                    delete config.meta;
                }
                if (!config.maxContentLength) config.maxContentLength=5000000;
                //console.log('PABLO debug ->consultar web',{config,data,attrs,tmp});
                //add comment
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                //prepare url
                /* was already prepared
                if (node.icons.includes('bell') && config.url.includes('**')) {
                    config.url = getTranslatedTextVar(config.url,true);
                } else {
                    config.url = `'${config.url}'`;
                }*/
                tmp.url = config.url;
                //join as object
                if (tmp.method.toLowerCase()=='get') {
                    config.params = data;
                } else {
                    config.data = data;
                }
                //delete config.url;
                //
                const js_config = context.jsDump(config);
                if (tmp.cache!=0) {
                    resp.open += `let ${tmp.var} = cache.get(object_hash(${js_config}));\n`;
                    resp.open += `if (!${tmp.var}) {\n`;
                    if (tmp.meta) {
                        resp.open += `  ${tmp.var} = await axios.request(${js_config});\n`;
                    } else {
                        resp.open += `  ${tmp.var} = (await axios.request(${js_config})).data;\n`;
                    }
                    resp.open += `  cache.set(object_hash(${js_config}),${tmp.var},${tmp.cache})\n`;
                    resp.open += `}\n`;
                } else {
                    if (tmp.meta) {
                        resp.open += `const ${tmp.var} = await axios.request(${js_config});\n`;
                    } else {
                        resp.open += `const ${tmp.var} = (await axios.request(${js_config})).data;\n`;
                    }
                }
                context.x_state.functions[resp.state.current_func].imports['axios'] = 'axios';
                //return
                return resp;
            }
        },
/*
        'def_consultar_web_cancelada': {
            x_icons: 'desktop_new',
            x_text_contains: 'consultar webxxxx,,',
            x_level: '>3',
            attributes_aliases: {
                ':method':       '_method,:metodo,:method,_metodo',
                ':response':     'responsetype,response,:responsetype,:response'
            },
            hint: 'Realiza una llamada a la url indicada enviando los datos definidos en sus atributos. Entrega resultados en variable definida luego de coma.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                let special = ':username,:password,:encoding,:maxlength,:redirects,:timeout';
                //prepare.
                let tmp = {
                    var:node.id,
                    meta:false,
                    simple:true,
                    proxy:false,
                    progress:true,
                    axios_call:'axios',
                    config: {
                        method:'get',
                        url:'',
                        data:{},
                        headers:{},
                        auth: {},
                        timeout:0,
                        response:'json',
                        maxContentLength:5000000
                    }
                };
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                //attributes
                let attrs = aliases2params('def_consultar_web', node, false, 'this.',true);
                //console.log('PABLO debug',attrs);
                //prepare attrs
                for (let x in attrs) {
                    if (x.charAt(0)==':') {
                        if (typeof attrs[x] === 'string') {
                            if (special.split(',').includes(x)==false && attrs[x].includes('.')==false) {
                                attrs[x.right(x.length-1)] = '**'+attrs[x]+'**';
                            } else if (attrs[x].includes('$store.') || attrs[x].includes('this.') || attrs[x].includes('process.env.')) {
                                attrs[x.right(x.length-1)] = '**'+attrs[x]+'**';
                            } else if (special.split(',').includes(x)==false) {
                                attrs[x.right(x.length-1)] = attrs[x];
                            }
                        } else {
                            attrs[x.right(x.length-1)] = attrs[x];
                        }
                        //delete attrs[x];
                    } else if (attrs[x].includes('**') && node.icons.includes('bell')) {
                        attrs[x] = getTranslatedTextVar(attrs[x],true);
                    }
                }
                //console.log('PABLO debug2',{attrs,exist:attrs[':url']});
                //
                delete attrs.refx;
                if (node.link!='') tmp.config.url = node.link.trim();
                if (attrs.progress) tmp.progress=attrs.progress; delete attrs.progress;
                if (attrs.meta) tmp.meta=true; delete attrs.meta;
                if (attrs[':url']) tmp.config.url = attrs[':url']; delete attrs[':url']; 
                let special_minus_method=special.split(',');
                special_minus_method.shift();
                for (let test of special_minus_method) {
                    if (attrs[test]) {
                        tmp.simple=false;
                        if (test==':username' || test==':password') {
                            tmp.config.auth[test] = attrs[test];
                        } else if (test==':encoding') {
                            tmp.config.responseEncoding = attrs[test];
                        } else {
                            //tmp.config[test.right(test.length-1)] = attrs[test];
                            tmp.config[test] = attrs[test];
                        }
                        delete attrs[test];
                    }
                }
                //extract headers from attrs (and keep data)
                for (let x in attrs) {
                    if (x.length>2 && x.substr(0,3)=='x-:') {
                        tmp.config.headers[x.right(x.length-3)] = attrs[x];
                        delete attrs[x];
                    } else if (x.length>2 && x.substr(0,2)=='x-') {
                        tmp.config.headers[x] = attrs[x];
                        delete attrs[x];
                    }
                }
                tmp.config.data = {...attrs};
                if (tmp.config.method.toLowerCase()=='get') {
                    delete tmp.config[':method'];
                    delete tmp.config.data[':method'];
                    tmp.config.data = { params:tmp.config.data };
                } else if (tmp.config.method.toLowerCase()=='postjson') {
                    delete tmp.config[':method'];
                    tmp.config.method = 'post';
                    tmp.config.data = { params:tmp.config.data };
                }
                //console.log('PABLO debug3 tmp',tmp);
                //simple or advanced?
                if (tmp.simple) {
                    //add comment
                    if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                    //prepare url
                    if (node.icons.includes('bell') && tmp.config.url.includes('**')) {
                        tmp.config.url = getTranslatedTextVar(tmp.config.url);
                    } else {
                        tmp.config.url = `'${tmp.config.url}'`;
                    }
                    delete tmp.config.data.params.url;
                    //
                    if (tmp.meta==true) {
                        resp.open += `const ${tmp.var} = await ${tmp.axios_call}.${tmp.config.method}(${tmp.config.url}, ${context.jsDump(tmp.config.data)});\n`;
                    } else {
                        resp.open += `const ${tmp.var} = (await ${tmp.axios_call}.${tmp.config.method}(${tmp.config.url}, ${context.jsDump(tmp.config.data)})).data;\n`;
                    }
                } else {
                    //advanced?
                    if (tmp.config.response && tmp.config.response!='json') {
                        tmp.config.responseType = tmp.config.response;
                    }
                    delete tmp.config.response;
                    //write data on close to support download/upload child events to config object
                    resp.state.from_consultar_web = node.id + '_config';
                    //add comment
                    if (node.text_note != '') resp.close += `// ${node.text_note.cleanLines()}\n`;
                    resp.close += `let ${node.id}_config = ${context.jsDump(tmp.config)};\n`;
                    //
                    if (tmp.meta) {
                        resp.close += `const ${tmp.var} = await ${tmp.axios_call}.request(${node.id}_config, { progress:${tmp.progress} });\n`;
                    } else {
                        resp.close += `
                        const ${tmp.var}_ = await ${tmp.axios_call}.request(${node.id}_config, { progress:${tmp.progress} });
                        const ${tmp.var} = ${tmp.var}_.data;\n`;
                    }
                }
                //return
                return resp;
            }
        },*/

        'def_consultar_web_upload': {
            x_icons: 'help',
            x_text_exact: 'upload',
            x_all_hasparent: 'def_consultar_web',
            x_level: '>2',
            hint: 'Evento para monitorear el progreso del upload de un consultar web padre (axios).',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `${state.from_consultar_web}.onUploadProgress = function(evento) {\n`;
                resp.close += `};\n`;
                return resp;
            }
        },

        'def_consultar_web_download': {
            x_icons: 'help',
            x_text_exact: 'download',
            x_all_hasparent: 'def_consultar_web',
            x_level: '>2',
            hint: 'Evento para monitorear el progreso del download de un consultar web padre (axios).',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `${state.from_consultar_web}.onDownloadProgress = function(evento) {\n`;
                resp.close += `};\n`;
                return resp;
            }
        },

        'def_enviar_correo': {
            x_icons: 'desktop_new',
            x_text_pattern: [`+(enviar|send) +(correo|email)`,`+(correo|email):+(enviar|send)`],
            x_level: '>2',
            attributes_aliases: {
                host:           'from:host,de:servidor',
                port:           'from:port,de:puerto',
                'auth.user':    'from:user,de:usuario',
                'auth.pass':    'from:pass,de:clave',
                from:           'from:email,de:correo,de,origen',
                replyTo:        'from:replyto,from:reply,replyto,reply',
                to:             'to:email,para:correo,correo',
                subject:        'to:subject,para:asunto,asunto',
                html:           'to:body,para:cuerpo,cuerpo,contenido,html,para:html',
                text:           'to:text,para:text',
                cc:             'to:cc,para:cc',
                bcc:            'to:bcc,para:bcc',
                gsuite:         'gmail,gsuite'
            },
            x_watch: `x_state.central_config.deploy`,
            hint: 'Utiliza los datos dados para enviar un correo electronico al destinatario indicado.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //attributes
                let attrs = aliases2params('def_enviar_correo', node, false, 'this.');
                let tmp = { transport:{}, mail:{}, gsuite:false };
                if (attrs.host) {
                    tmp.transport.host = attrs.host;
                    tmp.transport.secure = true;
                    delete attrs.host;
                }
                if (attrs.port) {
                    tmp.transport.port = attrs.port;
                    delete attrs.port;
                }
                if (attrs['auth.user'] && attrs['auth.pass']) {
                    tmp.transport.auth = {
                        user:attrs['auth.user'],
                        pass:attrs['auth.pass']
                    }
                    delete attrs['auth.user'];
                    delete attrs['auth.pass'];
                }
                if (attrs.gsuite) {
                    tmp.gsuite=true;
                    delete attrs.gsuite;
                }
                if (attrs['attach:base64']) {
                    let base = attrs['attach:base64'].split(',');
                    let name = base.shift();
                    let data = base.join(',');
                    attrs.attachments = [{
                        filename:name, content:`**Buffer.from('${data}','base64')**`
                    }];
                    delete attrs['attach:base64'];
                    //cfc supported multiple attach attrs, but we use attrs as Object and not array, so we can't found now
                }
                tmp.mail = {...attrs};
                tmp.is_real=true;
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                context.x_state.npm['nodemailer']='*';
                resp.open += `let n_${node.id} = require('nodemailer');\n`;
                if (tmp.transport.host) {
                    if (tmp.gsuite) {
                        context.x_state.npm['nodemailer-smtp-transport']='*';
                        resp.open += `let s_${node.id} = require('nodemailer-smtp-transport');\n`;
                        resp.open += `let t_${node.id} = n_${node.id}.createTransport(s_${node.id}(${context.jsDump(tmp.transport)}));\n`;
                    } else {
                        resp.open += `let t_${node.id} = n_${node.id}.createTransport(${context.jsDump(tmp.transport)});\n`;
                    }
                } else {
                    // host is undefined, use AWS SES (only if deploy is eb:)
                    if (typeof context.x_state.central_config.deploy=='string' && 
                        (context.x_state.central_config.deploy.includes('eb:') || context.x_state.central_config.deploy=='local')) {
                        resp.open += `let t_${node.id} = n_${node.id}.createTransport({ SES: new AWS.SES({ apiVersion: '2010-12-01' }) });\n`;
                    } else {
                        //reset response
                        resp.open = '';
                        if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                        resp.open += `console.log('aws SES dummy upload call for sending email; you need to use deploy:eb or deploy:local to make this code real.');`;
                        tmp.is_real=false;
                    }
                }
                if (tmp.is_real==true) {
                    resp.open += `t_${node.id}.sendMail(${context.jsDump(tmp.mail)}, (error,info) => {`;
                    resp.close += `});\n`;
                } else {
                    resp.open += `let error=null, info=null;\n`;
                }
                return resp;
            }
        },

        'def_sendgrid_enviar_correo': {
            x_icons: 'desktop_new',
            x_text_pattern: [`sendgrid:+(enviar|send) +(correo|email)*`,`sendgrid:+(correo|email):+(enviar|send)*`],
            x_level: '>2',
            x_watch: `x_state.config_node.sendgrid.apikey`, //@todo we need to add to concepto watch support to check if this key exists first 5-jun-21
            hint: 'Utiliza los datos dados para enviar un correo electronico al destinatario indicado, utilizando Twillio Sendgrid.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //attributes
                let attrs = aliases2params('def_enviar_correo', node, false, 'this.');
                let tmp = { apikey:'', mail:{} };
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                if (attrs.from && attrs.from.includes(',')) {
                    let base = attrs.from.split(',');
                    let email = base.shift();
                    let name = base.join(',');
                    if (node.icons.includes('bell') && email.includes('**')) email = getTranslatedTextVar(email,true);
                    if (node.icons.includes('bell') && name.includes('**')) name = getTranslatedTextVar(name,true);
                    attrs.from = {
                        email,
                        name
                    }
                }
                //
                if (attrs.to && attrs.to.charAt(0)=='[' && attrs.to.slice(-1)==']') {
                    let safe = require('safe-eval');
                    attrs.to = safe(attrs.to);
                } else {
                    attrs.to = [attrs.to];
                }
                let multiple_to = [];
                if (Array.isArray(attrs.to) && attrs.to.length>0) {
                    //ex: p@p.cl,Name or ['p@p.cl,Name','p@p.cl,Name']
                    for (let x of attrs.to) {                    
                        if (x.includes(',')) {
                            let base = x.split(',');
                            let email = base.shift();
                            let name = base.join(',');
                            if (node.icons.includes('bell') && email.includes('**')) email = getTranslatedTextVar(email,true);
                            if (node.icons.includes('bell') && name.includes('**')) name = getTranslatedTextVar(name,true);
                            multiple_to.push({
                                email,
                                name
                            });
                        } else {
                            multiple_to.push(x);
                        }
                    }
                }
                attrs.to = multiple_to;
                if (attrs.apikey) { 
                    tmp.apikey = attrs.apikey;
                    delete attrs.apikey;
                }
                //templates and attr value translation
                Object.keys(attrs).map(function(att) {
                    let value = attrs[att];
                    if (typeof value == 'string' && node.icons.includes('bell') && value.includes('**')) {
                        value = getTranslatedTextVar(value,true);
                    }
                    if (att.includes('template:')) {
                        let llave = att.replaceAll('template:','');
                        if (!attrs.dynamic_template_data) attrs.dynamic_template_data={};
                        attrs.dynamic_template_data[llave] = value;
                        delete attrs[att];
                    }
                });
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                context.x_state.npm['@sendgrid/mail']='*';
                resp.open += `let n_${node.id} = require('@sendgrid/mail');\n`;
                //apikey
                if (tmp.apikey=='') {
                    if (context.isCI || (context.x_state.config_node.sendgrid && context.x_state.config_node.sendgrid.apikey)) {
                        resp.open += `n_${node.id}.setApiKey(process.env.SENDGRID_APIKEY);\n`;
                    } else {
                        throw `sendgrid:enviar correo - add missing attribute apikey or define one within node config->sendgrid->apikey`;
                    }
                } else if (node.icons.includes('bell')) {
                    resp.open += `n_${node.id}.setApiKey(${getTranslatedTextVar(tmp.apikey)});\n`;
                } else {
                    resp.open += `n_${node.id}.setApiKey('${tmp.apikey}');\n`;

                }
                //send
                if (tmp.var) {
                    resp.open += `let ${tmp.var} = `;
                }
                resp.open += `await n_${node.id}.send(${context.jsDump(attrs)});`;
                return resp;
            }
        },

        'def_puppeteer': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(puppeteer|navegador)*`,
            x_level: '>2',
            attributes_aliases: {
                'headless':         'invisible,headless'
            },
            x_watch: `x_state.central_config.deploy`,
            hint: 'Crea una instancia de puppeteer para automatizar acciones de un navegador Chrome (por defecto es invisible o headless).\nDevuelve instancia de browser.',
            func: async function(node, state) {
                let resp = context.reply_template({
                    state
                });
                //attributes
                let attrs = aliases2params('def_puppeteer', node, false, 'this.');
                let tmp = {};
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                //deploy dependant
                if (context.x_state.central_config.deploy.includes('eb:')) {
                    attrs.executablePath = '/usr/bin/google-chrome-stable';
                    attrs.headless = true;
                    attrs.sandbox = false;
                    tmp.lib = 'puppeteer-core';
                    context.x_state.npm['puppeteer-core'] = '*';
                } else {
                    tmp.lib = 'puppeteer';
                    context.x_state.npm['puppeteer'] = '*';
                    context.x_state.npm['puppeteer-core'] = '*';                    
                }
                //general conditions
                if (attrs.sandbox && attrs.sandbox==false) {
                    attrs.args = ['--no-sandbox','--disable-setuid-sandbox'];
                    delete attrs.sandbox;
                }
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `let ${node.id} = require('${tmp.lib}');\n`;
                if (tmp.var) resp.open += `let ${tmp.var} = `;
                resp.open += `await ${node.id}.launch(${context.jsDump(attrs)});\n`;
                return resp
            }
        },

        'def_array_transformar': {
            x_icons: 'desktop_new',
            x_text_pattern: [`array:+(transformar|manipular)*`],
            x_level: '>2',
            hint:  `Transforma los campos del array de estructuras entregado, restringiendo los campos incluidos, o bien manipulando sus valores.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                if (node.icons.includes('bell') && tmp.text.includes('**')) {
                    tmp.text = getTranslatedTextVar(tmp.text);
                }
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                //code
                context.x_state.functions[resp.state.current_func].imports['underscore'] = '_';
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (tmp.var && tmp.var.includes('this.')) {
                    resp.open += `${tmp.var} = _.map(${tmp.text}, function(o${node.level}) {\n`; //})
                } else {
                    resp.open += `let ${tmp.var} = _.map(${tmp.text}, function(o${node.level}) {\n`;
                }
                resp.open += `let ${node.id} = o${node.level};\n`;
                Object.keys(node.attributes).map(function(att) {
                    let name = att.trim();;
                    let value = node.attributes[att];
                    if (name.charAt(0)!=':' && name.charAt(0)!='.') {
                        if (node.icons.includes('bell')) {
                            value = getTranslatedTextVar(value);
                        }
                        if (isNumeric(value) || value.substr(0,2)=='$.') {
                        } else if (value.includes(`'`)) {
                        } else if (value.includes('**') && node.icons.includes('bell')) {
                        } else if (value!=node.attributes[att]) {
                        } else if (value!='') {
                            if (value.charAt(0)=='!') {
                                value = `!${tmp.text}.${name}`;
                            }
                        }
                    }
                    //
                    if (name.toLowerCase()==':campos') {
                        resp.open += `${node.id} = _.pick(o${node.level}, ${context.jsDump(value.split(',')).replaceAll('[','').replaceAll(']','')});\n`;
                    } else {
                        if (value.includes('(') && value.includes(')') && value.includes('?')) {
                            value = value.replaceAll(`(.`,`(o${node.level}.`);
                            value = value.replaceAll(`?.`,`?o${node.level}.`);
                            value = value.replaceAll(`:.`,`:o${node.level}.`);
                            resp.open += `${node.id}.${name} = ${value};\n`;
                        } else {
                            resp.open += `${node.id}.${name} = o${node.level}${value};\n`;
                        }
                    }
                });
                resp.open += `return ${node.id};\n`;
                resp.open += `});\n`;
                //return
                return resp;
            }
        },

        'def_consultar_athena': {
            x_icons: 'desktop_new',
            x_text_pattern: `consultar athena "*",*`,
            x_level: '>2',
            x_watch: 'x_state.central_config.deploy',
            hint:  `Consulta la tabla indicada de AWS Athena, con las condiciones especificadas en sus atributos y devuelve la info en la var luego de la coma.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                if (node.text.includes(',')) tmp.var=node.text.split(',').splice(-1)[0].trim();
                tmp.model = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                let escapeKeyVars = function(text) {
                    let resp = text;
                    let changes = {
                        '{now}': 'new Date()'
                    };
                    Object.keys(changes).map(function(key) {
                        if (typeof resp == 'string') {
                            resp = resp.replaceAll(key,changes[key]);
                        }
                    });
                    return resp;
                };
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                //attr
                let select = { fields:[], where:[], order:[], limit:'' };
                Object.keys(node.attributes).map(function(att) {
                    let name = att;
                    let value = node.attributes[att].trim();
                    let operator = '=';
                    let not = false;
                    if (':fields,:campos'.split(',').includes(att.toLowerCase())) {
                        if (value.includes('=')) {
                            let fields = value.split(',');
                            for (let field of fields) {
                                if (field.includes('=')) {
                                    let field_name = field.split('=')[0];
                                    let field_as = field.split('=').pop();
                                    if (field.includes(':unicos')) {
                                        field_name = field_name.replaceAll(':unicos','');
                                        select.fields.push(`DISTINCT(${field_name}) as ${field_as}`);
                                    } else {
                                        select.fields.push(`${field_name} as ${field_as}`);
                                    }
                                } else if (field.includes(':unicos')) {
                                    let field_name = field.replaceAll(':unicos','');
                                    select.fields.push(`DISTINCT(${field_name})`);
                                } else {
                                    select.fields.push(field);
                                }
                            }
                        } else {
                            select.fields.push(value);
                        }
                    } else if ('order by,_order by,_orderby,:orderby,:order by'.split(',').includes(att.toLowerCase())) {
                        if (value.includes(' asc')) {
                            select.order.push(`${value.replaceAll(' asc','')} ASC`);
                        } else if (value.includes(' desc')) {
                            select.order.push(`${value.replaceAll(' desc','')} DESC`);
                        } else {
                            select.order.push(`${value} ASC`);
                        }
                    } else {
                        // any other field is a where...
                        // search value for this field
                        if (node.icons.includes('bell') && value.includes('**')) {
                            //value = getTranslatedTextVar(value,false);
                            value = value.replaceAll('**','||');
                        } else if (value.includes('{') && value.includes('}')) {
                            value = escapeKeyVars(value);
                        } else {
                            value = `'${value}'`;
                        }
                        //
                        if (name.includes(':') && name.includes('[')==false) {
                            // ex field:in
                            operator = name.split(':').pop().trim().toLowerCase();
                            name = name.split(':')[0];
                            value = node.attributes[att]; //original attr value
                            if (isNumeric(value)) {
                            } else if (value.includes(',') && value.includes(',')==false) {
                                //@todo double-check this (cfc had loop through each field for translating vars)
                                value = context.jsDump(value.split(','));
                            } else if (value.includes('**') && node.icons.includes('bell')) {
                                value = value.replaceAll('**','||');
                            } else if (value.includes('{') && value.includes('}')) {
                                value = escapeKeyVars(value);
                            }
                            if (operator=='in') {
                                select.where.push(`${name} IN ${value}`);
                            }
                        } else if (isNumeric(value)) {
                            select.where.push(`${name}=${value}`);
                        } else if ('<,>,='.split(',').includes(node.attributes[att].charAt(0))) {
                            operator = node.attributes[att].charAt(0);
                            value = node.attributes[att].right(node.attributes[att].length-1);
                            if (operator=='<') {
                                select.where.push(`${name}<${escapeKeyVars(value)}`);
                            } else if (operator=='>') {
                                select.where.push(`${name}>${escapeKeyVars(value)}`);
                            } else if (operator=='=') {
                                select.where.push(`${name}=${escapeKeyVars(value)}`);
                            }
                        } else if (value.charAt(0)=='*' || value.right(1)=='*') {
                            //like -- @todo add support for not like
                            value = `\'${value.replaceAll('*','%')}\'`;
                            operator = ` LIKE `;
                            select.where.push(`${name} LIKE ${value}`);
                        } else {
                            //literal equal field x=y
                            select.where.push(`${name}=${value}`);
                        }
                    }
                });
                //build SELECT statement
                tmp.select = `SELECT * FROM ${tmp.model}`;
                if (select.fields.length>0) {
                    tmp.select = `SELECT ${select.fields.join(',')} FROM ${tmp.model}`;
                }
                if (select.where.length>0) {
                    tmp.select += ` WHERE ${select.where.join(' AND ')}`;
                }
                if (select.order.length>0) {
                    tmp.select += ` ORDER BY ${select.order.join(',')}`;
                }
                if (select.limit!='') tmp.select += ` LIMIT ${select.limit}`;
                //post-process
                tmp.select = tmp.select.replaceAll('&apos;',`'`);
                tmp.select = tmp.select.replaceAll('||',`**`);
                if (node.icons.includes('bell') && tmp.select.includes('**')) {
                    tmp.select = getTranslatedTextVar(tmp.select,true);
                }
                //code
                context.x_state.npm['athena-express']='*';
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (typeof context.x_state.central_config.deploy=='string' && 
                (context.x_state.central_config.deploy.includes('eb:') || context.x_state.central_config.deploy=='local')) {
                    context.x_state.functions[resp.state.current_func].imports['athena-express'] = 'athenaexpress';
                    resp.open += `const athenaExpress = new athenaexpress({ aws:AWS });\n`;
                    resp.open += `let ${tmp.var}_i = await athenaExpress.query({ sql:${tmp.select} });\n`;
                    resp.open += `let ${tmp.var} = ${tmp.var}_i.Items;\n`;
                } else {
                    resp.open += `console.log('athena dummy: you need to use deploy:eb or deploy:local to generate the real code for this command.');`;
                }             
                return resp;
            }
        },

        /* IMAGE X_COMMANDS */
        'def_imagen_nueva': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):+(nueva|new),*`,
            x_level: '>2',
            attributes_aliases: {
                'width':            'ancho,width',
                'height':           'alto,height',
                'color':            'bgcolor,color'
            },
            hint:  `Crea una nuevo objeto imagen (jimp) con las caracteristicas de sus atributos, y la asigna en la variable dada despues de la coma. El color de fondo del nodo, define el color de fondo de la imagen.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.var=node.text.split(',').splice(-1)[0].trim();
                //attrs
                let attrs = aliases2params('def_imagen_nueva',node);
                if (!attrs.width) attrs.width=200;
                if (!attrs.height) attrs.height=200;
                if (node.icons.includes('bell')) {
                    if (typeof attrs.width=='string' && attrs.width.includes('**')) {
                        attrs.width = getTranslatedTextVar(attrs.width,false);
                    }
                    if (typeof attrs.height=='string' && attrs.height.includes('**')) {
                        attrs.height = getTranslatedTextVar(attrs.height,false);
                    }
                }
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `var ${tmp.var} = new jimp(${attrs.width},${attrs.height}`;
                if (attrs.color) {
                    resp.open += `,jimp.rgbaToInt(${attrs.color})`;
                } else if (node.bgcolor!='') {
                    resp.open += `,0x${node.bgcolor.replaceAll('#','').toUpperCase()}FF`;
                }
                resp.open += `);\n`;
                return resp;
            }
        },

        'def_imagen_leer': {
            x_icons: 'desktop_new',
            x_text_contains: `imagen:leer "|jimp:read "`,
            x_level: '>2',
            hint:  `Lee el objeto binario/ruta definido en las comillas, y lo asigna como objeto imagen en la variable dada despues de la coma.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.var = node.text.split(',').splice(-1)[0].trim();
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //attrs
                let attrs = aliases2params('def_imagen_leer',node);
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,false);
                } else if (tmp.text.includes('../')) {
                    if (node.icons.includes('bell') && tmp.text.includes('**')) {
                        tmp.text = `require('path').resolve(__dirname,${getTranslatedTextVar(tmp.text,false)})`;
                    } else {
                        tmp.text = `require('path').resolve(__dirname,'${tmp.text}')`;
                    }
                }
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `var ${tmp.var} = await jimp.read(${tmp.text});\n`;
                return resp;
            }
        },

        'def_imagen_escalar': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):+(escalar|scale) "*"`,
            x_level: '>2',
            attributes_aliases: {
                width:      'ancho,width',
                height:     'alto,height',
                algo:       'algorithmn,algoritmo,metodo,method,modo'
            },
            hint:  `Escala las dimensiones de la variable imagen dada, a la definicion de sus atributos.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //attrs
                let attrs = aliases2params('def_imagen_escalar',node);
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,false);
                }
                if (attrs.algo) {
                    if ('nearest,nearest neighbor,neighbor'.split(',').includes(attrs.algo)) {
                        attrs.algo = `jimp.RESIZE_NEAREST_NEIGHBOR`;
                    } else if ('bilinear,bi'.split(',').includes(attrs.algo)) {
                        attrs.algo = `jimp.RESIZE_BILINEAR`;
                    } else if ('bicubic,bicubico'.split(',').includes(attrs.algo)) {
                        attrs.algo = `jimp.RESIZE_BICUBIC`;
                    } else if ('hermite'==attrs.algo) {
                        attrs.algo = `jimp.RESIZE_HERMITE`;
                    } else if ('bezier'==attrs.algo) {
                        attrs.algo = `jimp.RESIZE_BEZIER`;
                    }
                }
                if (attrs.width=='auto' || !attrs.width) attrs.width = 'jimp.AUTO';
                if (attrs.height=='auto' || !attrs.height) attrs.height = 'jimp.AUTO';
                if (node.icons.includes('bell')) {
                    if (attrs.width && attrs.width.includes('**')) {
                        attrs.width = getTranslatedTextVar(attrs.width);
                    }
                    if (attrs.height && attrs.height.includes('**')) {
                        attrs.height = getTranslatedTextVar(attrs.height);
                    }
                }
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `await ${tmp.text}.resize(${attrs.width},${attrs.height}`;
                if (attrs.algo) resp.open += `,${attrs.algo}`;
                resp.open += `);\n`;
                return resp;
            }
        },

        'def_imagen_cambiar_color': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):+(cambiar|change) color "*"`,
            x_level: '>2',
            attributes_aliases: {
                source:     'de,from,source,desde',
                target:     'a,por,to,target,hasta',
                delta:      'delta,margen'
            },
            hint:  `Reemplaza el color indicado (de) por el nuevo en la imagen dada.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //attrs
                let attrs = aliases2params('def_imagen_cambiar_color',node);
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,true);
                }
                //map special values
                Object.keys(attrs).map(function(key) {
                    if (attrs[key]=='alpha') {
                        attrs[key]='#00000000';
                        attrs['type']='hex';
                        attrs['delta']=10;
                    } else if (node.icons.includes('bell') && attrs[key].includes('**')) {
                        attrs[key] = getTranslatedTextVar(attrs[key],true);
                    }
                });
                if (attrs.source) {
                    attrs.targetColor = attrs.source;
                    if (attrs.source.includes('#')) {
                        attrs.type = 'hex';
                    } else if (attrs.source.includes(',')) {
                        attrs.type = 'rgb';                        
                        attrs.targetColor = attrs.source.split(',');
                    }
                    delete attrs.source;
                }
                if (attrs.target) {
                    attrs.replaceColor = attrs.target;
                    if (attrs.target.includes('#')) {
                        attrs.type = 'hex';
                    } else if (attrs.target.includes(',')) {
                        attrs.type = 'rgb';
                        attrs.replaceColor = attrs.target.split(',');
                    } 
                    delete attrs.target;
                }
                //build data object
                let data = {
                    image:tmp.text,
                    deltaE:attrs.delta,
                    colors: {
                        type:attrs.type,
                        targetColor:attrs.targetColor,
                        replaceColor:attrs.replaceColor
                    }
                };
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                context.x_state.npm['replace-color'] = '2.1.0';
                context.x_state.functions[resp.state.current_func].imports['replace-color'] = 'replacecolor';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `${getTranslatedTextVar(tmp.text,false)} = await replacecolor(${context.jsDump(data)});\n`;
                return resp;
            }
        },

        'def_imagen_composite': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):composite "*"`,
            x_level: '>2',
            attributes_aliases: {
                image:                  'imagen,image',
                x:                      'horizontal,x',
                y:                      'vertical,y',
                opacitySource:          'opacidad imagen,apacidad_imagen,opacity_source,opacitysource',
                opacityDestination:     'opacidad origen,opacidad_origen,opacity_destination,opacitydestination,opacity_dest,opacitydest',
                mode:                   'metodo,method,modo,mode'
            },
            hint:  `Posiciona la imagen dada en la imagen indicada.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //attrs
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                let attrs = aliases2params('def_imagen_composite',node);
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,false);
                }
                //map special values
                Object.keys(attrs).map(function(key) {
                    if (node.icons.includes('bell') && attrs[key].includes('**')) {
                        attrs[key] = getTranslatedTextVar(attrs[key],true);
                    }
                    if (attrs[key].includes('**')==false && !isNumeric(attrs[key])) {
                        attrs[key] = `'${attrs[key]}'`;
                    }
                });
                if (attrs.mode) {
                    if ('source_over,default,imagen'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_SOURCE_OVER';
                    } else if ('destination_over,origen'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_DESTINATION_OVER';
                    } else if ('multiply,multiplicar'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_MULTIPLY';
                    } else if ('screen'==attrs.mode) {
                        attrs.mode = 'jimp.BLEND_SCREEN';
                    } else if ('overlay'==attrs.mode) {
                        attrs.mode = 'jimp.BLEND_OVERLAY';
                    } else if ('darken,oscurecer'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_DARKEN';
                    } else if ('lighten,aclarar,aclarecer'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_LIGHTEN';
                    } else if ('hardlight,luz dura'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_HARDLIGHT';
                    } else if ('difference,diferencia'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_DIFFERENCE';
                    } else if ('exclusion,excluir'.split(',').includes(attrs.mode)) {
                        attrs.mode = 'jimp.BLEND_EXCLUSION';
                    }
                }
                //build data object
                let data = [
                    attrs.image,
                    attrs.x,
                    attrs.y
                ];
                if (attrs.mode || attrs.opacitySource || attrs.opacityDestination) {
                    data.push({});
                }
                if (attrs.mode) data[data.length-1].mode = attrs.mode;
                if (attrs.opacitySource) data[data.length-1].opacitySource = attrs.opacitySource;
                if (attrs.opacityDestination) data[data.length-1].opacityDestination = attrs.opacityDestination;
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `await ${tmp.text}.composite(${context.jsDump(data).replaceAll('[','').replaceAll(']','')});\n`;
                return resp;
            }
        },

        'def_imagen_mask': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):+(mask|mascara) "*"`,
            x_level: '>2',
            attributes_aliases: {
                image:                  'imagen,image',
                x:                      'horizontal,x',
                y:                      'vertical,y'
            },
            hint:  `Define una mascara sobre la imagen entregada.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                //attrs
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                let attrs = aliases2params('def_imagen_mask',node);
                if (!attrs.x) attrs.x=0;
                if (!attrs.y) attrs.y=0;
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,false);
                }
                //map special values
                Object.keys(attrs).map(function(key) {
                    if (node.icons.includes('bell') && attrs[key].includes('**')) {
                        attrs[key] = getTranslatedTextVar(attrs[key],true);
                    }
                    if (attrs[key].includes('**')==false && !isNumeric(attrs[key])) {
                        attrs[key] = `'${attrs[key]}'`;
                    }
                });
                //build data object
                let data = [
                    attrs.image,
                    attrs.x,
                    attrs.y
                ];
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `await ${tmp.text}.mask(${context.jsDump(data).replaceAll('[','').replaceAll(']','')});\n`;
                return resp;
            }
        },
        
        'def_imagen_base64': {
            x_icons: 'desktop_new',
            x_text_pattern: `+(imagen|jimp):base64 "*",*`,
            x_level: '>2',
            attributes_aliases: {
                format:       'formato,format',
                quality:      'calidad,quality'
            },
            hint:  `Obtiene el base64 de la imagen dada en el formato indicado.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = {};
                tmp.text = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                tmp.var = node.text.split(',').splice(-1)[0].trim();
                //attrs
                let isNumeric = function(n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                let attrs = aliases2params('def_imagen_base64',node);
                if (node.icons.includes('bell') && tmp.text.includes('**') && tmp.text.includes('../')==false) {
                    tmp.text = getTranslatedTextVar(tmp.text,false);
                }
                if (attrs.format) {
                    let test = attrs.format.toLowerCase().trim();
                    if (test == 'png') {
                        attrs.format = 'jimp.MIME_PNG';
                    } else if (test == 'jpg') {
                        attrs.format = 'jimp.MIME_JPEG';
                    } else if (test == 'tif') {
                        attrs.format = 'jimp.MIME_TIF';
                    } else if (test == 'gif') {
                        attrs.format = 'jimp.MIME_GIF';
                    } else if (test == 'bmp') {
                        attrs.format = 'jimp.MIME_BMP';
                    } else if (test == 'auto') {
                        attrs.format = 'jimp.AUTO';
                    }
                }
                //install jimp
                context.x_state.npm['jimp'] = '0.6.4';
                context.x_state.functions[resp.state.current_func].imports['jimp'] = 'jimp';
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (attrs.quality) {
                    resp.open += `await ${tmp.text}.quality(${attrs.quality});\n`;
                }
                resp.open += `var ${tmp.var} = await ${tmp.text}.getBase64Async(${attrs.format});\n`;
                return resp;
            }
        },

        /* END IMAGE X_COMMANDS */
        'def_xcada_registro': {
            x_icons: 'penguin',
            x_text_contains: `por cada registro en`,
            x_level: '>2',
            attributes_aliases: {
                'use_index':        'index',
                'unique':           'unique,id',
                'target':           'template,target'
            },
            hint:  `Repite sus hijos por cada elemento entrecomillas, dejando el item en curso en la variable luego de la coma.`,
            func: async function(node, state) {
                let resp = context.reply_template({ state });
                let tmp = { key:'', has_await:false, query:node.text, target:'' };
                if (tmp.query.includes('$store.')) tmp.query = tmp.query.replaceAll('$store.','$store.state.');
                if (tmp.query.includes(',')) tmp.key=tmp.query.split(',').splice(-1)[0].trim();
                tmp.iterator = context.dsl_parser.findVariables({
                    text: tmp.query,
                    symbol: `"`,
                    symbol_closing: `"`
                }).trim();
                if (tmp.iterator.charAt(0)=='$' &&
                    !tmp.iterator.includes('$variables.') &&
                    !tmp.iterator.includes('$vars.') &&
                    !tmp.iterator.includes('$store.') &&
                    !tmp.iterator.includes('$params.') &&
                    !tmp.iterator.includes('$route.')) {
                    tmp.iterator = tmp.iterator.right(tmp.iterator.length-1);
                }
                let sons = await node.getNodes();
                if (sons.length==1) {
                    tmp.target = sons[0].id;
                } else if (sons.length>1) {
                    tmp.target = 'template';
                }
                let attrs = aliases2params('def_xcada_registro',node);
                let params = { unique:0, key:0, target:tmp.target, tipo:'v-for', iterator:tmp.iterator, item:tmp.key, use_index:`${tmp.key}_index` };
                if (params[':template']) {
                    params.target = 'template';
                    delete params[':template']; delete params['template'];
                }
                params = {...params,...attrs};
                if (params.unique==0) params.unique = params.use_index;
                if (state.get_params) {
                    resp.state.params = params;
                    delete resp.state.get_params;
                    return resp;
                }
                //code (only from scripting)
                if (node.icons.includes('bell') && params.iterator.includes('**')) {
                    params.iterator = getTranslatedTextVar(params.iterator);
                }
                params.iterator = params.iterator   .replaceAll('$variables.','this.')
                                                    .replaceAll('$vars.','this.')
                                                    .replaceAll('$params.','this.');
                context.x_state.functions[resp.state.current_func].imports['underscore'] = '_';
                //search consultar web nodes
                if (!params[':each'] && sons.length>0) {
                    for (let x of sons) {
                        if (x.text.includes('consultar web')) {
                            tmp.has_await = true;
                            break;
                        }
                        await setImmediatePromise(); //@improved
                    }
                }
                //write code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (tmp.has_await==true) {
                    resp.open += `_.each(${params.iterator}, async function(${params.item},${params.use_index}) {`;
                    resp.close = `}, this);`;
                } else {
                    resp.open += `for (let ${params.use_index}=0;${params.use_index}<${params.iterator}.length;${params.use_index}++) {`;
                    resp.open += `let ${params.item} = ${params.iterator}[${params.use_index}];\n`;
                    resp.close = `}\n`;
                }
                //
                return resp;
            }
        },

        //*def_responder (@todo i18n)
        //**def_insertar_modelo (@todo test it after adding support for events)
        //**def_consultar_modelo
        //**def_modificar_modelo
        //**def_eliminar_modelo
        //**def_consultar_web
        //**def_consultar_web_upload
        //**def_consultar_web_download
        //*def_aftertime
        //*def_struct
        //*def_extender
        //*def_npm_instalar
        //*def_probar
        //*def_probar_error (ex.def_event_try)
        //*def_literal_js
        //*def_console
        //**def_xcada_registro
        //*def_crear_id_unico

        'def_guardar_nota': {
        	x_level: '>2',
        	x_icons: 'desktop_new',
            x_text_contains: 'guardar nota|capturar nota|note:save|save note',
            attributes_aliases: {
                'strip':      'text,strip,limpio',
                'html':       ':html',
                'strip':      ':strip',
                'asis':       ':asis,asis,as_it_was'
            },
            meta_type: 'script',
            hint: 'Crea una variable con el contenido HTML indicado en la nota del nodo.',
        	func: async function(node, state) {
                let resp = context.reply_template({ state });
                // attrs
                let attrs = {...{ html:true, asis:false },...aliases2params('def_guardar_nota', node, false, 'this.', true)};
                delete attrs.refx;
                if (attrs[':html']) attrs.html=true;
                if (attrs[':strip']) attrs.html=false;
                if (attrs.strip) attrs.html=false;
                //prepare
                let tmp = { content:node.text_note_html };
                tmp.var = node.text.split(',').pop().trim();
                if (attrs.html) {
                    if (node.text_rich!='') tmp.content = node.text_rich; //this has inner of body already
                    //parse content
                    if (!attrs[':asis'] && !attrs.asis) {
                        //transform tags 'p' style:text-align:center to <center>x</center>
                        //transform <p>x</p> to x<br/>.
                        let cheerio = require('cheerio');
                        let sub = cheerio.load(tmp.content, { ignoreWhitespace: false, xmlMode:true, decodeEntities:false });
                        let paragraphs = sub('p').toArray();
                        paragraphs.map(function(elem) {
                            let cur = sub(elem);
                            let style = cur.attr('style');
                            if (style && style.includes('text-align:center')) {
                                //transform tags 'p' style:text-align:center to <center>x</center>
                                cur.replaceWith(`<center>${cur.html()}</center>`);
                            } else {
                                cur.replaceWith(`${cur.html()}<br/>`);
                            }
                        });
                        tmp.content = sub.html();
                    }
                }
                //escape variables
                if (node.icons.includes('bell') && tmp.content.includes('**')) {
                    tmp.content = getTranslatedTextVar(tmp.content.cleanLines().trim());
                } else {
                    tmp.content = `'${tmp.content.cleanLines()}'`;
                }
                //code
                //if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                resp.open += `let ${tmp.var} = ${tmp.content};\n`;
                return resp;
            }
        },

        'def_agregar_campos': {
        	x_level: '>2',
        	x_icons: 'desktop_new',
            x_text_contains: 'agregar campos a',
            meta_type: 'script',
            hint: `Agrega los campos definidos en sus atributos (y valores) a cada uno de los registros de la variable de entrada (array de objetos).\n
                   Si hay una variable definida, se crea una nueva instancia del array con los campos nuevos, en caso contrario se modifican los valores de la variable original.`,
        	func: async function(node, state) {
                let resp = context.reply_template({ state });
                //get vars and attrs
                let tmp = { var:'' };
                if (node.text.includes(',')) tmp.var = node.text.split(',').pop().trim();
                tmp.original = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                });
                if (state.from_server) {
                    tmp.var = tmp.var.replaceAll('$variables.','resp.')
                                     .replaceAll('$vars.','resp.')
                                     .replaceAll('$params.','resp.');
                    tmp.original = tmp.original.replaceAll('$variables.','resp.')
                                     .replaceAll('$vars.','resp.')
                                     .replaceAll('$params.','resp.');
                } else if (tmp.var!='') {
                    tmp.var = tmp.var.replaceAll('$variables.','this.')
                                     .replaceAll('$vars.','this.')
                                     .replaceAll('$params.','this.')
                                     .replaceAll('$store.','this.$store.state.');pon
                    tmp.original = tmp.original.replaceAll('$variables.','this.')
                                               .replaceAll('$vars.','this.')
                                               .replaceAll('$params.','this.');
                }
                if (tmp.original.includes('**') && node.icons.includes('bell')) {
                    tmp.original = getTranslatedTextVar(tmp.original);
                }
                // create obj from current node as js obj
                tmp.attr = await context.x_commands['def_struct'].func(node, { ...state, ...{
                    as_object:true
                }});
                delete tmp.attr.refx;
                //change this to resp if parent is server
                if (state.from_server) tmp.attr.open = tmp.attr.open.replaceAll('this.','resp.');
                //add underscore
                if (state.current_page) {
                    context.x_state.pages[state.current_page].imports['underscore'] = '_';
                } else if (state.current_proxy) {
                    context.x_state.proxies[state.current_proxy].imports['underscore'] = '_';
                } else if (state.current_store) {
                    context.x_state.stores[state.current_store].imports['underscore'] = '_';
                }
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (tmp.var.includes('this')) {
                    resp.open += `${tmp.var} = _.map(${tmp.original}, function(element) {
                        element = Object.assign(element,${tmp.attr.open});
                        return _.extend({},element,${tmp.attr.open});
                    });`;
                } else if (tmp.var!='') {
                    resp.open += `let ${tmp.var} = _.map(${tmp.original}, function(element) {
                        element = Object.assign(element,${tmp.attr.open});
                        return _.extend({},element,${tmp.attr.open});
                    });`;
                } else {
                    resp.open += `${tmp.original} = _.each(${tmp.original}, function(element) {
                        element = Object.assign(element,${tmp.attr.open});
                    });`;
                }
                return resp;
            }
        },

        'def_var_clonar': {
        	x_level: '>2',
        	x_icons: 'desktop_new',
            x_text_contains: 'clonar variable|copiar variable|variable:clonar|variable:copiar',
            attributes_aliases: {},
            hint: `Crea una copia de la variable indicada, en la variable luego de la coma.`,
        	func: async function(node, state) {
                let resp = context.reply_template({ state });
                //get vars and attrs
                let tmp = { var:'', original:'' };
                if (node.text.includes(',')) tmp.var = node.text.split(',').pop().trim();
                //prepare new var
                if (tmp.var.includes('$')) {
                    if (state.from_server) {
                        tmp.var = tmp.var.replaceAll('$variables.', 'resp.')
                                        .replaceAll('$vars.', 'resp.')
                                        .replaceAll('$params.', 'resp.');
                    } else {
                        tmp.var = tmp.var.replaceAll('$variables.', 'this.')
                                        .replaceAll('$vars.', 'this.')
                                        .replaceAll('$params.', 'this.')
                                        .replaceAll('$config.', 'process.env.')
                                        .replaceAll('$store.', 'this.$store.state.');
                        if (tmp.var=='this.') tmp.var='this';
                    }
                }
                //prepare original var
                tmp.original = context.dsl_parser.findVariables({
                    text: node.text,
                    symbol: `"`,
                    symbol_closing: `"`
                });
                if (tmp.original.includes('**') && node.icons.includes('bell')) {
                    tmp.original = getTranslatedTextVar(tmp.original);
                } else if (tmp.original.includes('$')) {
                    if (state.from_server) {
                        tmp.original = tmp.original.replaceAll('$variables.', 'resp.')
                                                    .replaceAll('$vars.', 'resp.')
                                                    .replaceAll('$params.', 'resp.');
                    } else {
                        tmp.original = tmp.original.replaceAll('$variables.', 'this.')
                                                    .replaceAll('$vars.', 'this.')
                                                    .replaceAll('$params.', 'this.')
                                                    .replaceAll('$config.', 'process.env.');
                        if (tmp.original=='this.') tmp.original='this';
                    }
                }
                //code
                if (node.text_note != '') resp.open += `// ${node.text_note.cleanLines()}\n`;
                if (tmp.var.includes('this.')) {
                    resp.open += `${tmp.var} = JSON.parse(JSON.stringify(${tmp.original}));\n`;
                } else {
                    resp.open += `let ${tmp.var} = JSON.parse(JSON.stringify(${tmp.original}));\n`;
                }
                return resp;
            }
        },

        //**def_guardar_nota
        //**def_agregar_campos
        //**def_preguntar
        //def_array_transformar (pending)
        //def_procesar_imagen
        //def_imagen_exif
        //**def_var_clonar
        //--def_modificar (invalid node for vue)
        //**def_enviarpantalla (todo test)
    
        //**def_analytics_evento - @todo test
        //def_medianet_ad - @todo think about the script2 code issue with cheerio

        // OTHER node types
        /*'def_imagen': {
        	x_icons:'idea',
        	x_not_icons:'button_cancel,desktop_new,help',
        	x_not_empty:'attributes[:src]',
        	x_empty:'',
        	x_level:'>2',
        	func:async function(node,state) {
        		return context.reply_template({ otro:'Pablo', state });
        	}
        },*/

        //
    }
};

//private helper methods
function setObjectKeys(obj, value) {
    let resp = obj;
    if (typeof resp === 'string') {
        resp = {};
        let keys = obj.split(',');
        for (let i in keys) {
            resp[keys[i]] = value;
        }
    } else {
        for (let i in resp) {
            resp[i] = value;
        }
    }
    return resp;
}

function setToValue(obj, value, path) {
    var i;
    path = path.split('.');
    for (i = 0; i < path.length - 1; i++)
        obj = obj[path[i]];

    obj[path[i]] = value;
}

function getVal(project, myPath) {
    return myPath.split('.').reduce((res, prop) => res[prop], project);
}