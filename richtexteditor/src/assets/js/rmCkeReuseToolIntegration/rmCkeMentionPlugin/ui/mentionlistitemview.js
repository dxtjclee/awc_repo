/* global
   CKEDITOR5
*/
/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
/**
 * @module mention/ui/mentionlistitemview
 */

export default class MentionListItemView extends ckeditor5ServiceInstance.ListItemView {
    highlight() {
        const child = this.children.first;

        child.isOn = true;
    }

    removeHighlight() {
        const child = this.children.first;

        child.isOn = false;
    }
}
