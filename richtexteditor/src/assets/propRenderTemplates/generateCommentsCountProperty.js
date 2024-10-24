// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/generateCommentsCountProperty
 */
import {getBaseUrlPath} from 'app';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import reqUtils from 'js/requirementsUtils';
import localeSvc from 'js/localeService';

var exports = {};

/**
 * Generates comments icon DOM Element for Summary Table Proxy object
 * @param { Object } vmo - ViewModelObject for which comments text is being rendered
 * @param { Object } containerElem - The container DOM Element inside which comments text will be rendered
 */
export let generateRmCommentsCountRendererFn = function( vmo, containerElem ) {
    var commentsProp = null;
    var commentsCount = '0';
    if ( vmo.props && vmo.props.arm0CommentsCount ) {
        commentsProp = vmo.props.arm0CommentsCount;
    }
    if ( commentsProp && commentsProp.dbValues && commentsProp.dbValues.length > 0 ) {
        commentsCount = commentsProp.dbValues[0];
    }

    var objectUid = vmo.uid;
    if( vmo.modelType.name === 'Arm0SummaryTableProxy' && vmo.props.arm0SourceElement ) {
        objectUid = vmo.props.arm0SourceElement.dbValues[0];
    }
    if ( commentsCount ) {
        _renderCommentsIndicator( objectUid, containerElem, parseInt( commentsCount ) );
    }
};

/**
 * @param {String} objectUid - object uid
 * @param { Object } containerElem - The container DOM Element inside which comments text will be rendered
 * @param {String} commentsCount - the number of comments that exist
 */
var _renderCommentsIndicator = function( objectUid, containerElem, commentsCount ) {
    if ( commentsCount > 0 ) {
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localTextBundle = localeSvc.getLoadedText( resource );
        var parentDiv = document.createElement( 'div' );
        parentDiv.className = 'aw-requirementsmanager-summaryTableContent';
        var cellImg = document.createElement( 'img' );
        cellImg.className = 'aw-visual-indicator aw-commands-command aw-requirementsmanager-summaryTableIcon aw-aria-border';
        cellImg.title = localTextBundle.showComment;
        cellImg.alt = localTextBundle.showComment;
        cellImg.tabIndex = 0;
        var imgSrc = getBaseUrlPath() + '/image/typeComment48.svg';
        cellImg.src = imgSrc;
        parentDiv.appendChild( cellImg );
        containerElem.appendChild( parentDiv );

        [ 'click', 'keypress' ].forEach( ( eventType )=>{
            cellImg.addEventListener( eventType, function() {
                var modelObject = cdm.getObject( objectUid );
                var cellProp = [ 'arm1ParaNumber', 'awb0ArchetypeName', 'awb0ArchetypeId', 'awb0UnderlyingObject', 'awb0UnderlyingObjectType' ];
                var arrModelObjs = [ modelObject ];
                reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
                    var selectedRefObj = {
                        paraNum: modelObject.props.arm1ParaNumber.dbValues[0],  //ParaNumber
                        name: modelObject.props.awb0ArchetypeName.dbValues[0], //object_name
                        id: modelObject.props.awb0ArchetypeId.dbValues[0], //item_id
                        type: modelObject.type, //object_type
                        uid: modelObject.uid, // uid of Arm0RequirementElement
                        revID: modelObject.props.awb0UnderlyingObject.dbValues[0], //underlying Object uid
                        revType: modelObject.props.awb0UnderlyingObjectType.dbValues[0], //underlying Object Type
                        modelRevObject: { uid: modelObject.props.awb0UnderlyingObject.dbValues[0], type: modelObject.props.awb0UnderlyingObjectType.dbValues[0] } //underlying Object
                    };
                    appCtxService.registerCtx( 'summaryTableSelectedObjUid', selectedRefObj );
                    eventBus.publish( 'requirementDocumentation.getRequirementContent' );
                } );
            } );
        } );
    }
};

export default exports = {
    generateRmCommentsCountRendererFn
};
