import MathUI from 'js/rmCkeInsertEquation/mathui';
import MathEditing from 'js/rmCkeInsertEquation/mathediting';
import AutoMath from 'js/rmCkeInsertEquation/automath';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

export default class Math extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ MathEditing, MathUI, AutoMath, ckeditor5ServiceInstance.Widget ];
    }

    static get pluginName() {
        return 'Math';
    }
}
