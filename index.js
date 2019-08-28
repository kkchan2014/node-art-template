/*---------------------------------------------------------------------------------------------
 *  Copyright (c) kkChan(694643393@qq.com). All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict'

const extend = require('extend');
const template = require('art-template');

module.exports = {
    inject: function(resources) {
        template.defaults.imports.$json = function (content) {
            return JSON.stringify(content);
        };
        template.defaults.imports.$base64 = function (content) {
            return Buffer.from(content instanceof Object ? JSON.stringify(content) : content).toString('base64');
        };

        /**
         * 阻止node.js art-template解析<script type="text/html"></script>内容
         * 模板内容中如果存在方法调用, 传入的字符串参数内容不能包含["]符号
         */
        template.defaults.rules.splice(0, 0, {
            test: /<script.+?type="text\/html"[^>]*>[\s\S]*?<\/script>/ig,
            use: function (match, code) {
                var output = match.toString().replace(/"/gm, '\\"').replace(/\r/gm, '\\\r').replace(/\n/gm, '\\n');

                return {
                    code: `"${output}"`,
                    output: 'raw'
                }
            }
        });
        /**
         * 加入{{!Variable}}语法, 用于输出JSON原文, 防止JSON内容被编码输出
         */
        template.defaults.rules.splice(1, 0, {
            test: /\{\{\!(.+?)\}\}/ig,
            use: function (match, code) {
                return {
                    code: `$json(${code})`,
                    output: 'raw'
                }
            }
        });

        /**
         * join with empty
         * @param {any} array
         * @param {any} c
         */
        function _join(array, c) {
            for (var i = 0; i < array.length; i++) {
                if (!array[i] || array[i] == '') {
                    array.splice(i, 1);

                    i--;
                }
            }

            return array.join(c);
        };

        var RES = {
            buildUrl: (src, appendPattern) => {
                var base = (resources ? (resources.base || '') : '').trimEnd2('/');
                var pattern = (resources && resources.pattern && appendPattern !== false) ? resources.pattern : '';

                return [base, `${src.trimStart2('/')}${pattern}`].join('/');
            },
            buildElement: (ext, tag, args) => {
                var minimize = typeof args[args.length - 1] === 'boolean' ? args[args.length - 1] : false;
                var items = [];

                for (var i = 0; i < args.length; i++) {
                    var item = args[i];

                    if (typeof item !== 'string') continue;

                    if (item[0] === '-' || item[0] === '.') {
                        item = `${args[0]}${item}`;
                    }

                    if (!item.endWith(`.${ext}`)) {
                        item = `${item}.${minimize ? `min.${ext}` : ext}`;
                    }

                    items.push(tag.replace('[URL]', RES.buildUrl(item)));
                }

                return items.join('\n\t');
            }
        };

        extend(template.defaults.imports, {
            toString: function (value, format) {
                if (typeof value === 'number') {
                    return value.format(format);
                } else if (value instanceof Date) {
                    return value.format(format);
                } else if (typeof value === 'string' && (value === 'NOW' || value.isDate())) {
                    if (value === 'NOW') {
                        return new Date().format(format);
                    } else {
                        return new Date(value).format(format);
                    }
                }

                return value;
            },
            Class: function () {
                var result = [];

                for(var i = 0; i < arguments.length; i++) {
                    if(arguments[i] && arguments[i].trim() !== '') {
                        result.push(arguments[i].trim());
                    }
                }

                return result.join(' ');
            },
            resource: function (src) {
                return RES.buildUrl(src, false);
            },
            script: function () {
                return RES.buildElement('js', '<script type="text/javascript" src="[URL]"></script>', arguments);
            },
            style: function () {
                return RES.buildElement('css', '<link rel="stylesheet" href="[URL]" />', arguments);
            },
            plugin: function (path, useResPath, minimize) {
                path = path.trimEnd2('/');

                var imports = template.defaults.imports;
                var resName = path.substr(path.lastIndexOf('/') + 1);

                if (resName.startWith('!')) {
                    resName = resName.trimStart2('!');
                    path = path.substr(0, path.lastIndexOf('/'));
                }

                return [
                    imports.style(_join([path, useResPath ? 'css' : undefined, resName], '/'), minimize),
                    imports.script(_join([path, useResPath ? 'js' : undefined, resName], '/'), minimize)
                ].join('\n\t');
            }
        });
    }
};