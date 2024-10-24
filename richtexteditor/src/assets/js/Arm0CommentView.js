// Copyright (c) 2021 Siemens

/**
 * This Plugin is for enhancing the OOTB comment view to AW Standard.
 *
 * @module js/Arm0CommentView
 */
import localeService from 'js/localeService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

export default class NewCommentView extends ckeditor5ServiceInstance.CommentView {
    constructor( ...args ) {
        super( ...args );
        this.getTemplate();
    }
    getTemplate() {
        const commentView = super.getTemplate();
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        //locate edit button on the comment annotation
        const editButton = commentView.children[0].children[1].children[1].children[0];
        if( editButton ) {
            editButton.tooltip = localTextBundle.edit;
        }
        //locate delete button on the comment annotation
        const deleteButton = commentView.children[0].children[1].children[1].children[1];
        if( deleteButton ) {
            deleteButton.tooltip = localTextBundle.delete;
        }
        return commentView;
    }
}

