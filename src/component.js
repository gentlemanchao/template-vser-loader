import Parse from './vser/parse'; //编译模板
import VNode from './vser/vnode'; //虚拟dom
import Patch from './vser/patch'; //渲染和更新渲染


// 3.后端渲染
// 4.兼容到ie7

/***
 * 组件基类
 * 
 * 
 */

const isFunction = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Function]';
}


/**
 * 获取数据类型
 * @param {} obj 用于判断的数据
 */
const typeOf = function (obj) {
    const toString = Object.prototype.toString;
    const map = {
        '[object Boolean]': 'boolean',
        '[object Number]': 'number',
        '[object String]': 'string',
        '[object Function]': 'function',
        '[object Array]': 'array',
        '[object Date]': 'date',
        '[object RegExp]': 'regExp',
        '[object Undefined]': 'undefined',
        '[object Null]': 'null',
        '[object Object]': 'object'
    };
    return map[toString.call(obj)];
};

//?未用
const isBelowIe9 = function () {
    if (navigator.appName == "Microsoft Internet Explorer") {
        let version = navigator.appVersion.split(";")[1].trim();
        if (version === "MSIE 8.0" || version === "MSIE 7.0" || version === "MSIE 6.0") {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}
class Component {
    constructor(options) {
        this.$widget = null; //当前组件根节点的dom对象
        this.$$_el = options.el || null; //当前组件插入的插槽dom的对象
        this.html = options.html || null; //string|function //当前组件的html模板片段(运行时编译) | 模板渲染函数(构建时编译生成)
        this.parent = options.parent || null; //父组件实例
        this.$$_refName = options.ref || null; //当前组件实例的全局引用，可通过Component.$refs[ref]访问
        this.$$_customerComponents = options.components || {}; //自定义组件列表
        this.$$_vNode = new VNode();
        this.$$_childrenVnode = options.$$_childrenVnode || []; //插槽内部的虚拟节点
        this.$$_siblings = options.$$_siblings || null; //兄弟子节点
        this.$$_patch = null; //
        this.$$_tree = null; //虚拟dom树
        this.$$_watcher = null; //数据监听队列
        this.$$_eventQueue = {}; //事件队列
        this.$$_funcQueue = []; //下一帧回调函数队列
        this.$$_nextTickPending = false; //下一帧锁
        this.$$_nextRenderTickPender = false; //下一个渲染帧锁
        this.data = this.data();
        this.$$_props = options.$$_props || {}; //上级组件传递的参数
        this._$$_props = this.props();
        this.props = {};
        this.watcher = this.watcher();
        this.$parameters = options.parameters || {};
        this.$refs = {};
        this.$$_children = [];
        this._init();
    }

    /**
     * 组件创建后挂载前
     */
    created() {}
    data() {
        return {};
    }
    props() {
        return {};
    }
    watcher() {
        return {};
    }
    /**
     * 组件挂载前
     */
    beforeMounted() {}
    /**
     * 组件已挂载
     */
    mounted() {}
    /**
     * 视图更新前
     */
    beforeUpdated() {
        //重新渲染
        this.$$_setProps();
        this.$$_tree = this.$$_render();
        this.$$_patch.update(this.$$_tree);
        /**
         * 递归更新子组件
         */
        const recursion = function (childrenVNodes) {
            childrenVNodes.forEach((vnode) => {
                if (vnode && vnode.ctx && vnode.ctx.beforeUpdated) {
                    vnode.ctx.$$_props = vnode.data || {};
                    vnode.ctx.beforeUpdated();
                    vnode.children && vnode.children.length && recursion(vnode.children);
                }
            })
        }
        recursion(this.$$_tree.children || []);
        this.$nextTick(() => {
            //触发已更新生命周期方法
            this.updated();
        });
    }

    /**
     * 视图更新后
     */
    updated() {

    }
    /**
     * 组件销毁前
     */
    beforeDestroyed() {
        for (let key in this.children) {
            this.children[key].beforeDestroyed();
        }
    }
    /**
     * 组件已销毁
     */
    destroyed() {
        for (let key in this.children) {
            this.children[key].destroyed();
        }
        this.$$_patch.remove(this.$$_tree);
        this.children = {};
        this.$$_refName && this.$$_refName !== '' && (delete Component.$refs[this.$$_refName]);
    }

    /**
     * 编译前端模板（运行时编译）
     */
    $$_parseTemplate() {
        if (!isFunction(this.html)) {
            const ast = new Parse(this.html);
            let funcStr = ast.render();
            funcStr = funcStr.replace(/[\r\n]/g, '');
            this.$$_renderFunc = new Function(funcStr);
        } else {
            this.$$_renderFunc = this.html;
        }
    }
    /**
     * 初始化
     */
    _init() {
        //模板编译
        this.$$_parseTemplate();
        //触发组件已创建生命周期方法
        this.$$_setProps();
        this.created();
        // 递归渲染组件 并触发beforeMounted 和 mouted生命周期方法
        this.$$_initRender();
        this.$$_refName &&
            this.$$_refName !== '' &&
            (Component.$refs[this.$$_refName] = this); // ?????
        this.mounted();
    }
    /**
     * 设置props的值
     */
    $$_setProps() {
        const _props = this.$$_props || {}; //上级组件传递的参数
        const props = this._$$_props || {};
        const reservedKey = ['_c', '_t', '_for'];
        for (let key in props) {
            const prop = props[key];
            if (reservedKey.indexOf(key) !== -1) {
                console.error(`参数:"${key}"是保留关键字，禁止使用`);
                break;
            }
            if (typeof (_props[key]) !== 'undefined') {
                const value = _props[key];
                //参数类型校验 只做提醒不报错
                const type = prop.type;
                const valueType = typeOf(value);
                if (Number.name) {
                    //ie浏览器不校验参数类型
                    if (typeOf(type) === 'array') {
                        //多参数类型
                        let typeNames = [];
                        for (let i = 0, len = type.length; i < len; i++) {
                            const _type = type[i];
                            const typeName = _type.name.toLowerCase();
                            typeNames.push(typeName);
                            if (valueType === typeName) {
                                typeNames.length = 0;
                                break;
                            }
                        }

                        if (typeNames.length) {
                            console.error(`参数:"${key}"类型有误，应该是:"${typeNames.join(',')}"之一, 实际是:"${valueType}"`);
                        }

                    } else {
                        //单个参数类型
                        const typeName = type.name.toLowerCase();
                        if (valueType !== typeName) {
                            console.error(`参数:"${key}"类型有误，应该是:"${typeName}", 实际是:"${valueType}"`);
                        }
                    }
                }

                //校验通过
                this.props[key] = _props[key];
            } else {
                this.props[key] = prop.default || null;
            }
        }
    }

    /**
     * 初始化前端渲染
     */
    $$_initRender() {
        this.beforeMounted();
        if (this.$$_el && this.$$_renderFunc) {
            this.$$_tree = this.$$_render();
            this.$$_patch = new Patch(this.$$_el, this.$$_tree, this);
        } else {
            console.error(`找不到组件${this.$$_refName||''}的插槽`);
        }
    }


    /**
     * 渲染
     */
    $$_render() {
        return this.$$_renderFunc.call(Object.assign(this, this.$$_vNode.__proto__));
    }

    /**
     * data数据更新
     * @param {object} _data  {x:1,y:2}键值对
     */
    set(_data) {
        for (let key in _data) {
            this.data[key] = _data[key];
        }
        this.$$_nextRenderTick();
    }
    /**
     * 触发事件
     */
    $emit() {
        const args = arguments;
        const name = args[0];
        const _func = this.$$_props[`@${name}`];
        if (_func && _func.func && typeof _func.func === 'function') {
            let _args = [];
            if (_func.params && _func.params.length) {
                _args = _func.params;
            } else {
                for (let i = 1; i < arguments.length; i++) {
                    _args.push(arguments[i]);
                }
            }
            _func.func.apply(this.parent, _args);
        }
    }
    /**
     * 下一帧延时方法
     * @param {Function} callback 下一帧执行的回调方法
     */
    $$_nextFrame(callback) {
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame =
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function (_callback) {
                    return window.setTimeout(_callback, 1000 / 60);
                };
        }
        window.requestAnimationFrame(function () {
            callback && callback();
        });
    }
    /**
     * 下一帧渲染
     */
    $$_nextRenderTick() {
        if (this.$$_nextRenderTickPender) return;
        this.$$_nextRenderTickPender = true;
        this.$$_nextFrame(() => {
            this.beforeUpdated();
            this.$$_nextRenderTickPender = false;
        });
    }
    /**
     * 下一帧延时方法
     * @param {Function} callback 下一帧执行的回调方法
     */
    $nextTick(callback) {
        this.$$_funcQueue.push(callback);
        if (this.$$_nextTickPending) return;
        this.$$_nextTickPending = true;
        this.$$_nextFrame(() => {
            const funcQueue = this.$$_funcQueue.slice(0);
            for (let i = 0; i < funcQueue.length; i++) {
                funcQueue[i]();
            }
            this.$$_funcQueue.length = 0;
            this.$$_nextTickPending = false;
        });
    }
}
export default Component;