const Parse = require('./src/parse');

/**
 * 移除注释
 * @param {*} content 
 */
var removeRemark = function (content) {
    const reg = /<!--[\s\S]*?-->/g
    return content.replace(reg, '');
}


module.exports = function (source) {
    this.cacheable && this.cacheable();
    source = removeRemark(source);
    const ast = new Parse(source);
    let funcStr = ast.render();
    funcStr = funcStr.replace(/[\r\n]/g, '');
    return `module.exports = function(){${funcStr}}`;
};