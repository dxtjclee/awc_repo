// Copyright (c) 2022 Siemens

/**
 * Module for the HTML Spec Template Page
 *
 * @module js/Arm0HTMLSpecTemplateEdit
 */
import cdm from 'soa/kernel/clientDataModel';
import reqACEUtils from 'js/requirementsACEUtils';
import reqUtils from 'js/requirementsUtils';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import _commandService from 'js/command.service';
import commandHandlerService from 'js/commandHandlerService';
import editHandlerService from 'js/editHandlerService';
import dataSourceService from 'js/dataSourceService';
import leavePlaceService from 'js/leavePlace.service';
import notyService from 'js/NotyModule';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import $ from 'jquery';
import ckeditorOperations from 'js/ckeditorOperations';

var exports = {};

var _data = null;

var _saveTxt = null;
var _discardTxt = null;

var uidFileNameMap = {};
var _singleLeaveConfirmation = null;

var HTML_SPEC_TMPL_EDIT_CONTEXT = 'HTML_SPEC_TMPL_EDIT_CONTEXT';

/**
 * Ignore and replace string literals with empty characters.
 *
 * @private
 *
 * @param {String} escapedSafe - escapedSafe HTML String which needs to be replacing string literals (\n,
 *            \t, \r, \, /, \b, \f) with empty characters.
 *
 * @return {String} Returns replaced string by removing string literals.
 */
var _ignoreStringLiterals = function( escapedSafe ) { //eslint-disable-line no-unused-vars
    return escapedSafe.replace( /\\n/g, '' ).replace( /\\t/g, '' ).replace( /\\r/g, '' ).replace( /\\b/g,
        '' ).replace( /\\f/g, '' );
};
/**
 * Save to Server.
 * @return {Promise} Promise that is resolved when save edit is complete
 */
export let createUpdateContents = function() {
    var deferred = AwPromiseService.instance.defer();

    if( _checkCKEditorDirty( _data.requirementCtx.AWRequirementsEditor.id ) ) {
        var widgetsToSave = ckeditorOperations.getAllWidgetData( _data.requirementCtx.AWRequirementsEditor.id, appCtxSvc.ctx );

        if( !widgetsToSave || !widgetsToSave.elements ) {
            var errorMsg = _data.i18n.invalidObjectName.replace( '{0}', appCtxSvc.ctx.selected.props.object_string.uiValues[ 0 ] );
            messagingService.showError( errorMsg );
            deferred.reject( errorMsg );
        } else {
            var jsonContent = _generateHtmlSpecContent( widgetsToSave );

            var revObject = cdm.getObject( _data.uidHtmlSpecTemplate );

            var strJsonContent = _ignoreStringLiterals( JSON.stringify( jsonContent ) );

            var createUpdateInput = {
                inputs: [ {
                    objectToProcess: {
                        uid: revObject.uid,
                        type: revObject.type
                    },
                    bodyText: strJsonContent,
                    lastSavedDate: revObject.props.lsd.dbValues[ 0 ],
                    contentType: 'REQ_HTML',
                    isPessimisticLock: true
                } ]
            };

            var promise = soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement',
                'setRichContent2', createUpdateInput );

            promise.then( function( response ) {
                deferred.resolve( response );
            } )
                .catch( function( error ) {
                    deferred.reject( error );
                } );
        }
    } else {
        deferred.resolve();
    }
    return deferred.promise;
};
/**
 * To reset undo of ckeditor
 * @param {Object} data data
 */
var _resetUndoOfCkeditor = function( data ) {
    var ckeId = data.requirementCtx.AWRequirementsEditor.id;
    if( ckeId ) {
        ckeditorOperations.resetUndo( ckeId );
    }
};

/**
 * process HTML BodyText before save.
 *
 * @param {String} bodyText - body text
 * @return {String} updated bodyText
 */
var _preProcessBeforeSave = function( bodyText ) {
    bodyText = reqUtils.processHTMLBodyText( bodyText );

    bodyText = '<start>' + bodyText + '<end>';
    return bodyText;
};

var _getHtmlSpecTemplateJson = function( data, jsonData, parentId, parentType ) {
    if( !jsonData.contents ) {
        return null;
    }

    data.HTML_CONTENT += _addWrapperOnBodyText( jsonData.name, jsonData.level, jsonData.internalType, jsonData.uniqueID, parentId, parentType, jsonData.contents );
    for( var i = 0; i < jsonData.children.length; i++ ) {
        _getHtmlSpecTemplateJson( data, jsonData.children[ i ], jsonData.uniqueID, jsonData.internalType );
    }
    data.dispatch({ path: 'data.HTML_CONTENT', value: data.HTML_CONTENT });
};
var _findElementInHtmlSpecTemplateJson = function( jsonData, uid ) {
    var uniqueID = jsonData.uniqueID;
    if( !uniqueID ) {
        return null;
    }
    if( uniqueID === uid ) {
        return jsonData;
    }
    for( var i = 0; i < jsonData.children.length; i++ ) {
        var resultJson = _findElementInHtmlSpecTemplateJson( jsonData.children[ i ], uid );
        if( resultJson ) {
            return resultJson;
        }
    }
    return null;
};

var _filterHtmlContentToSave = function( htmlContent ) {
    var htmlDiv = document.createElement( 'div' );
    htmlDiv.innerHTML = htmlContent;

    var reqDiv = htmlDiv.getElementsByClassName( 'aw-requirement-bodytext' );
    return reqDiv[ 0 ].innerHTML;
};

var _addChildInHtmlSpecTemplateJson = function( rootElement, newRequirement ) {
    var uid = newRequirement.elementID;
    var contents = _filterHtmlContentToSave( newRequirement.contents );
    var objName = newRequirement.name;
    var objType = newRequirement.type;

    var parentElement = newRequirement.parentElement;
    var parentElementUid = newRequirement.parentID;
    if( parentElement && parentElement.uid ) {
        parentElementUid = parentElement.uid;
    }
    uid = uid.replace( 'RM::NEW', 'RM::OLD' );
    parentElementUid = parentElementUid.replace( 'RM::NEW', 'RM::OLD' );

    contents = _preProcessBeforeSave( contents );

    if( !rootElement.hasOwnProperty( 'name' ) ) {
        var level = '';
        rootElement = _createTreeContentForObject( objName, objType, level, uid, contents );
    } else {
        var resultJson = _findElementInHtmlSpecTemplateJson( rootElement, parentElementUid );
        if( resultJson ) {
            var level = resultJson.level !== '' ? resultJson.level + '.' + ( resultJson.children.length + 1 ) : ( resultJson.children.length + 1 ).toString();
            var jsonObj = _createTreeContentForObject( objName, objType, level, uid, contents );
            resultJson.children.push( jsonObj );
        }
    }
    return rootElement;
};

var _generateHtmlSpecContent = function( widgetsToSave ) {
    var rootElement = {};
    var allElements = widgetsToSave.elements;

    if( allElements !== null && allElements.length > 0 ) {
        for( var i = 0; i < allElements.length; i++ ) {
            var newRequirement = allElements[ i ];
            rootElement = _addChildInHtmlSpecTemplateJson( rootElement, newRequirement );
        }

        return rootElement;
    }
};

/**
 * Cancel all edits made in document
 */
export let cancelEdits = function() {
    exports.unloadContent();

    // Event to load the saved contents
    eventBus.publish( 'Arm0HTMLSpecTemplateEdit.initContent' );
};

/**
 * Update Paragraph number/level after move up,Move down, Promote and Demote operation
 * @param {object} jsonContent json object for HTML Spec content
 */
var _updateLevel = function( jsonContent ) {
    var parentLevel = jsonContent.level;
    var arrElements = jsonContent.children;

    for( var i = 0; i < arrElements.length; i++ ) {
        var level = parentLevel !== '' ? parentLevel + '.' + ( i + 1 ) : ( i + 1 ).toString();

        arrElements[ i ].level = level;
        _updateLevel( arrElements[ i ] );
    }
};
/**
 * Swap position of two element within Array. In case of Move up and Move down element
 * position is changed within array.
 * @param {Array} arrElements array of objects
 * @param {number} selElementIndex index of selected element
 * @param {number} otherElementIndex index of second element
 */
var _swap = function( arrElements, selElementIndex, otherElementIndex ) {
    //Swap element within array
    var tmpElement = arrElements[ otherElementIndex ];
    arrElements[ otherElementIndex ] = arrElements[ selElementIndex ];
    arrElements[ selElementIndex ] = tmpElement;

    var tmpLevel = JSON.parse( JSON.stringify( arrElements[ otherElementIndex ].level ) );
    arrElements[ otherElementIndex ].level = arrElements[ selElementIndex ].level;
    arrElements[ selElementIndex ].level = tmpLevel;

    // Update paragraph number post swap
    _updateLevel( arrElements[ otherElementIndex ] );
    _updateLevel( arrElements[ selElementIndex ] );
};

/**
 * Internal function to perform move up
 * @param {object} jsonContent json object for HTML Spec content
 * @param {string} uidElement uid of object to be moved
 * @returns {boolean} true if move operation completed else false if it can not be moved
 */

var _moveUp = function( jsonContent, uidElement ) {
    var arrElements = jsonContent.children;
    var otherElementIndex = -1;
    var selElementIndex = -1;
    var moved = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueID;
        if( uniqueID === uidElement && i > 0 ) {
            otherElementIndex = i - 1;
            selElementIndex = i;
            break;
        }
        if( _moveUp( arrElements[ i ], uidElement ) ) {
            moved = true;
            break;
        }
    }

    if( otherElementIndex >= 0 && selElementIndex > 0 ) {
        _swap( arrElements, selElementIndex, otherElementIndex );
        moved = true;
    }
    return moved;
};
/**
 * Internal function to perform move down
 * @param {object} jsonContent json object for HTML Spec content
 * @param {string} uidElement uid of object to be moved
 * @returns {boolean} true if move operation completed else false if it can not be moved
 */
var _moveDown = function( jsonContent, uidElement ) {
    var arrElements = jsonContent.children;
    var otherElementIndex = -1;
    var selElementIndex = -1;
    var moved = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueID;
        if( uniqueID === uidElement && i < arrElements.length - 1 ) {
            otherElementIndex = i + 1;
            selElementIndex = i;
            break;
        }
        if( _moveDown( arrElements[ i ], uidElement ) ) {
            moved = true;
            break;
        }
    }

    if( otherElementIndex > 0 && selElementIndex >= 0 ) {
        _swap( arrElements, selElementIndex, otherElementIndex );
        moved = true;
    }
    return moved;
};

/**
 * Internal function to perform promote
 * @param {object} element elements children to be searched for element to be promoted
 * @param {object} parentElement parent of parent of element
 * @param {string} uidElement uid of object to be moved
 * @returns {boolean} true if move operation completed else false if it can not be moved
 */
var _promote2 = function( element, parentElement, uidElement, index ) {
    var arrElements = element.children;
    var promoted = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueID;
        if( uniqueID === uidElement && parentElement ) {
            var deletedElement = arrElements.splice( i, 1 );
            parentElement.children.splice( index + 1, 0, deletedElement[ 0 ] );
            _updateLevel( parentElement );

            return true;
        }
        if( _promote2( arrElements[ i ], element, uidElement, i ) ) {
            promoted = true;
            break;
        }
    }
    return promoted;
};
/**
 * Internal function to perform promote
 * @param {object} jsonContent json object for HTML Spec content
 * @param {string} uidElement uid of object to be moved
 * @returns {boolean} true if move operation completed else false if it can not be moved
 */
var _promote = function( jsonContent, uidElement ) {
    var arrElements = jsonContent.children;
    var promoted = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        if( _promote2( arrElements[ i ], jsonContent, uidElement, i ) ) {
            promoted = true;
            break;
        }
    }
    return promoted;
};
/**
 * Internal function to perform demote
 * @param {object} jsonContent json object for HTML Spec content
 * @param {string} uidElement uid of object to be moved
 * @param {object} newParentElement New parent object
 * @returns {boolean} true if move operation completed else false if it can not be moved
 */

var _demote = function( jsonContent, uidElement, newParentElement ) {
    var arrElements = jsonContent.children;
    var demoted = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueID;
        if( uniqueID === uidElement && i > 0 ) {
            var deletedElement = arrElements.splice( i, 1 );
            arrElements[ i - 1 ].children.push( deletedElement[ 0 ] );
            _updateLevel( jsonContent );
            newParentElement.uid = arrElements[ i - 1 ].uniqueID;
            return true;
        }
        if( _demote( arrElements[ i ], uidElement, newParentElement ) ) {
            demoted = true;
            break;
        }
    }

    return demoted;
};

/**
 * Internal function to get json object from ckeditor content
 * @param {object} data view model data
 * @returns {object} json object for HTML Spec content in ckEditor
 */
var _getJsonContentFromCkEditor = function( data ) {
    var widgetsToSave = ckeditorOperations.getAllWidgetData( data.requirementCtx.AWRequirementsEditor.id, appCtxSvc.ctx );
    return _generateHtmlSpecContent( widgetsToSave );
};

/**
 * Internal function to perform post opearation post move up, move down ,promote, demote
 * @param {object} data view model data
 * @param {object} jsonContent json object for HTML Spec content in ckEditor
 * @param {object} selectedObject  selected object on which moved operation is performed
 * @param {Object} rmHtmlSpecLocnState Html Spec Locn State
 * @param {object} newParentElement  new parent element of moved object. It will have value in case of "Demote" only
 */
var _postMoveOperation = function( data, jsonContent, selectedObject, rmHtmlSpecLocnState, newParentElement ) {
    // Get the contents that set it in the data
    _getHtmlSpecTemplateJson( data, jsonContent, '', '' );
    data.HTML_SPEC_TEMPLATE_CONTENT = jsonContent;
    const rmHtmlSpecLocnStateValue = { ...rmHtmlSpecLocnState.value };
    rmHtmlSpecLocnStateValue.HTML_SPEC_TEMPLATE_CONTENT = jsonContent;
    rmHtmlSpecLocnState.update( rmHtmlSpecLocnStateValue );

    _preprocessContentsAndSetToEditor( data );
    eventBus.publish( 'showActionPopup.close' );
    eventBus.publish( 'importPreview.refreshTreeDataProvider' );

    _resetUndoOfCkeditor( data );
    //Ensure new parent node is expanded in case of demote
    if( newParentElement && newParentElement.uid ) {
        setTimeout( function() {
            var eventData = {
                parentObjectUid: newParentElement.uid
            };
            eventBus.publish( 'Arm0HTMLSpecTemplateTree.expandNode', eventData );
        }, 100 );
    }
    setTimeout( function() {
        if( selectedObject ) {
            var eventData = {
                objectsToSelect: [ { uid: selectedObject } ]
            };
            eventBus.publish( 'aceElementsSelectionUpdatedEvent', eventData );
            ckeditorOperations.getCKEditorInstance( data.requirementCtx.AWRequirementsEditor.id ).fire( 'change' );
        }
    }, 300 );
};
/**
 * Move up operation move selected element one position up in same level of hierarchy
 * @param {object} data view model data
 * @param {String} moveAction move action
 * @param {Object} rmHtmlSpecLocnState Html Spec Locn State
 */
export let moveUp = function( data, moveAction, rmHtmlSpecLocnState ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = _getJsonContentFromCkEditor( data );
    if( _moveUp( jsonContent, selectedObjUid ) ) {
        data.HTML_CONTENT = '';
        data.movedSuccessfully = true;
        _postMoveOperation( data, jsonContent, selectedObjUid, rmHtmlSpecLocnState );
    }
    eventBus.publish( 'showActionPopup.close' );
};

/**
 * Move down operation move selected element one position below in same level of hierarchy
 * @param {object} data view model data
 * @param {String} moveAction move action
 * @param {Object} rmHtmlSpecLocnState Html Spec Locn State
 */
export let moveDown = function( data, moveAction, rmHtmlSpecLocnState ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = _getJsonContentFromCkEditor( data );
    if( _moveDown( jsonContent, selectedObjUid ) ) {
        data.movedSuccessfully = true;
        data.HTML_CONTENT = '';
        _postMoveOperation( data, jsonContent, selectedObjUid, rmHtmlSpecLocnState );
    }
    eventBus.publish( 'showActionPopup.close' );
};

/**
 * Promote operation move selected element to parent level of hierarchy
 * @param {object} data view model data
 * @param {String} moveAction move action
 * @param {Object} rmHtmlSpecLocnState Html Spec Locn State
 */
export let promote = function( data, moveAction, rmHtmlSpecLocnState ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = _getJsonContentFromCkEditor( data );

    if( _promote( jsonContent, selectedObjUid ) ) {
        data.movedSuccessfully = true;
        data.HTML_CONTENT = '';
        _postMoveOperation( data, jsonContent, selectedObjUid, rmHtmlSpecLocnState );
    }
    eventBus.publish( 'showActionPopup.close' );
};
/**
 * Demote operation move selected element to its sibling's children  hierarchy
 * @param {object} data view model data
 * @param {String} moveAction move action
 * @param {Object} rmHtmlSpecLocnState Html Spec Locn State
 */
export let demote = function( data, moveAction, rmHtmlSpecLocnState ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = _getJsonContentFromCkEditor( data );
    var newParentElement = {
        uid: null
    };
    if( _demote( jsonContent, selectedObjUid, newParentElement ) ) {
        data.movedSuccessfully = true;
        data.HTML_CONTENT = '';
        _postMoveOperation( data, jsonContent, selectedObjUid, rmHtmlSpecLocnState, newParentElement );
    }
    eventBus.publish( 'showActionPopup.close' );
};

/**
 * Check if ckeditor instance created before setting contents
 * @param {Object} data - view model data
 */
export let isCkeditorInstanceReady = function (data) {
    const awRequirementsEditorCtx = _.get(data, 'requirementCtx.AWRequirementsEditor');
    let returnValue;
    if (awRequirementsEditorCtx && awRequirementsEditorCtx.id && awRequirementsEditorCtx.ready) {
        returnValue = {
            ckeditorReady: true
        };

        // If content is ready to set
        if (data.contentReady) {
            // If ckeditor is ready, set contents
            _data = data;
            _preprocessContentsAndSetToEditor(data);
            _registerEditHandler(data);
            _resetUndoOfCkeditor(data);

            const selectedObjectUid = [];
            selectedObjectUid.push(data.uidHtmlSpecTemplate);
            const ckEditorId = awRequirementsEditorCtx.id;
            setTimeout(function () {
                ckeditorOperations.scrollCKEditorToGivenObject(ckEditorId, selectedObjectUid);
            }, 3000);

            eventBus.publish('requirementDocumentation.DocTabLoaded');
            // Reset the flag
            returnValue.contentReady = false;
            return returnValue;


        }
    }

    return returnValue;
};

/**
 * Set CKEditor Content.
 *
 * @param {String} id- CKEditor ID
 * @param {String} content - content to set in CK Editor
 */

var _setCKEditorContent = function( id, content ) {
    setTimeout( function() {
        appCtxSvc.registerCtx( 'requirementEditorContentChanged', false );
        ckeditorOperations.setCKEditorContentAsync( id, content, appCtxSvc.ctx ).then( function() {
            _setContentChangeEventHandler( id );
            var ckEditor = ckeditorOperations.getCKEditorInstance( id );
            if( ckEditor && ckEditor.document ) {
                var editorDocumentBody = ckEditor.document.getBody().$;
                _getAllBrokenImageIDs( _data, editorDocumentBody );
                if( _data.missingRefImages.length > 0 ) {
                    eventBus.publish( 'Arm0HTMLSpecTemplateEdit.refreshRefImages' );
                }
            }
            eventBus.publish( 'specHtmlTemplate.addClickEventOnAllObjects' );
        } );
    }, 0 );
};

/**
 * Set CKEditor Content change event handler
 *
 * @param {String} id - CKEditor ID
 */
var _setContentChangeEventHandler = function( id ) {
    ckeditorOperations.setCkeditorChangeHandler( id, _changeEventListener, appCtxSvc.ctx );
};
/**
 * Function to listen content change event of ckeditor.
 * @param {Event} changeEvent change event triggered by ckeditor
 */
var _changeEventListener = function( changeEvent ) {
    if( !appCtxSvc.ctx.requirementEditorContentChanged ) {
        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
        _commandService.getCommand( 'Arm0HtmlSpecTemplateSaveEdits' ).then( function( command ) {
            if( command ) {
                commandHandlerService.setIsEnabled( command, true );
            }
        } );
    }
};
/**
 * Check CKEditor content changed / Dirty.
 *
 * @param {String} id- CKEditor ID
 * @return {Boolean} isDirty
 *
 */

var _checkCKEditorDirty = function( id ) {
    return ckeditorOperations.checkCKEditorDirty( id );
};

/**
 * Scroll CKEditor Content to the given element.
 *
 * @param {String} id- CKEditor ID
 * @param {String} selectedObjectUid- CKEditor ID
 */

var _scrollCKEditorToGivenObject = function( id, selectedObjectUid ) {
    setTimeout( function() {
        ckeditorOperations.scrollCKEditorToGivenObject( id, selectedObjectUid );
    }, 100 );
};

/**
 * Initialize
 *
 * @param {Object} data - The panel's view model object
 */
export let selectionChanged = function( data ) {
    data.selectedObjectUid = [];
    if( data.eventData && data.eventData.selected ) {
        appCtxSvc.updateCtx( 'visibleMoveCommandsForHTMLSpecTemplate', true );
        data.selectedObjectUid.push( data.eventData.selected.uid );
    } else {
        appCtxSvc.updateCtx( 'visibleMoveCommandsForHTMLSpecTemplate', false );
        data.selectedObjectUid.push( data.uidHtmlSpecTemplate );
    }
    setTimeout( function() {
        _scrollCKEditorToGivenObject( data.requirementCtx.AWRequirementsEditor.id, data.selectedObjectUid );
    }, 100 );
};

/**
 * Remove the handlers and events on content unloading
 */
export let unloadContent = function() {
    appCtxSvc.unRegisterCtx( 'requirementEditorContentChanged' );
    appCtxSvc.unRegisterCtx( 'visibleMoveCommandsForHTMLSpecTemplate' );

    editHandlerService.removeEditHandler( HTML_SPEC_TMPL_EDIT_CONTEXT );

    leavePlaceService.registerLeaveHandler( null );
};
var _removeStartnEndTags = function( strHTML ) {
    var strHTMLResult = strHTML.replace( '<start>', '' );
    strHTMLResult = strHTMLResult.replace( '<end>', '' );
    return strHTMLResult;
};
var _addWrapperOnBodyText = function( objName, level, objType, uniqueID, parentId, parentType, bodyText ) {
    var strLevel = level;

    var updatedBodyText = '';

    updatedBodyText = '<div class="aw-requirement-bodytext" contenteditable="false" isempty="true" style="cursor:pointer;background-color:#f0f0f0;">' +
        _removeStartnEndTags( bodyText ) +
        '</div>';

    if( level !== '' ) {
        updatedBodyText = '<div class="aw-requirement-bodytext" contenteditable="true" isempty="true">' +
            _removeStartnEndTags( bodyText ) +
            '</div>';
    }

    return ckeditorOperations.getObjHtmlTemplate( objName, strLevel, objType, uniqueID, parentId, parentType, updatedBodyText );
};
var _createHtmlContentForObject = function( objName, objType, uniqueID ) {
    return '<start><p> </p> <end>';
};

var _createTreeContentForObject = function( objName, objType, level, uniqueID, htmlContent ) {
    return {
        name: objName,
        internalType: objType,
        level: level,
        uniqueID: uniqueID,
        contents: htmlContent,
        Word_file_Ticket: '',
        children: []
    };
};

/**
 * load HTML Spec Template JSON
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Context object
 */
var _createFullTextOnSpecHtmlTemplate = function( uidHtmlSpecTemplate, jsonData ) {
    var revObject = cdm.getObject( uidHtmlSpecTemplate );

    var createUpdateInput = {
        inputs: [ {
            objectToProcess: {
                uid: revObject.uid,
                type: revObject.type
            },
            bodyText: '<div></div>',
            lastSavedDate: revObject.props.lsd.dbValues[ 0 ],
            contentType: 'REQ_HTML',
            isPessimisticLock: true
        } ]
    };

    var promise = soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement',
        'setRichContent2', createUpdateInput );

    promise.then( function( response ) {
        var fullTextObj = reqACEUtils.getObjectOfType( response.modelObjects, 'FullText' );
        if( fullTextObj ) {
            _data.fullTextObjUid = fullTextObj.uid;

            var inputData = [ {
                object: fullTextObj,
                timestamp: '',
                vecNameVal: [ {
                    name: 'body_text',
                    values: [
                        JSON.stringify( jsonData )
                    ]
                } ]
            } ];
            soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
                info: inputData
            } );
        }
    } );
};
var _createFirstTimeJson = function( uidHtmlSpecTemplate ) {
    var revObject = cdm.getObject( uidHtmlSpecTemplate );
    var name_obj = revObject.props.object_string.uiValues[ 0 ];

    var htmlContent = _createHtmlContentForObject( name_obj, 'RequirementSpec', uidHtmlSpecTemplate );
    return _createTreeContentForObject( name_obj, 'RequirementSpec', '', uidHtmlSpecTemplate, htmlContent );
};
// Start : Image related

/**
 * update data for fileData
 *
 * @param {Object} fileData key string value the location of the file
 * @param {Object} form form
 * @returns {Object} form data
 */
export let updateFormData = function( fileData, form ) {
    if( fileData && fileData.value && form ) {
        const formData = new FormData( $( form )[ 0 ] );
        formData.append( fileData.key, fileData.value );
        return formData;
    }
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertImage = function( data ) {
    if( data.fmsTicket ) {
        var imageURL = _getFileURL( data.fmsTicket );
        var uid = data.createdObject.uid;
        if( imageURL !== null ) {
            ckeditorOperations.insertImage( data.requirementCtx.AWRequirementsEditor.id, imageURL, uid );
        }
    }
};

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

var _getFileURL = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Add in missing image list. These images files tickets need to be updated.
 *
 * @param {Object} data - The panel's view model object
 * @param uidImage - uid of image
 */

var _addInMissingImageList = function( data, uidImage ) {
    var imanID = reqUtils.getFullTextRefObj( data.fullTextObject, uidImage );

    var objImage = {
        uid: imanID ? imanID : uidImage,
        type: 'unknownType'
    };

    if( imanID ) {
        uidFileNameMap[ imanID ] = uidImage;
        data.missingRefImages.push( objImage );
    }
};

/**
 * Read all image IDs that have broken links and add in missing Image list.
 *
 * @param {Object} data - The panel's view model object
 * @param innerHtml innerHtml
 * @return Any
 */

var _getAllBrokenImageIDs = function( data, innerHtml ) {
    data.fullTextObject = cdm.getObject( data.fullTextObjUid );

    var imgs = innerHtml.getElementsByTagName( 'img' );
    data.missingRefImages = [];

    for( var ii = 0; ii < imgs.length; ii++ ) {
        if( typeof imgs[ ii ].id !== 'undefined' && imgs[ ii ].id !== '' ) {
            if( imgs[ ii ].src.indexOf( 'base64' ) > -1 ) {
                continue;
            }
            if( !imgs[ ii ].complete ) {
                _addInMissingImageList( data, imgs[ ii ].id );
                continue;
            }
            if( typeof imgs[ ii ].naturalWidth !== 'undefined' && imgs[ ii ].naturalWidth === 0 ) {
                _addInMissingImageList( data, imgs[ ii ].id );
                continue;
            }
        }
    }
};

/**
 * Update broken image URL.
 *
 * @param innerHtml innerHtml
 * @param imageID image uid
 * @param ticket image file ticket
 */

var _updateImage = function( innerHtml, imageID, ticket ) {
    if( innerHtml && imageID && ticket ) {
        var imgs = innerHtml.getElementsByTagName( 'img' );

        var imageUrl = _getFileURL( ticket );
        for( var ii = 0; ii < imgs.length; ii++ ) {
            if( imgs[ ii ].id === imageID ) {
                imgs[ ii ].src = imageUrl;
            }
        }
    }
};
/**
 *
 * Update broken images urls with new url image file ticket
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let updateImages = function( data ) {
    var ckEditor = ckeditorOperations.getCKEditorInstance( data.requirementCtx.AWRequirementsEditor.id );
    if( ckEditor && ckEditor.document ) {
        var element = ckEditor.document.getBody().$;

        if( !element ) {
            return;
        }
        var innerHtml = element;

        if( data.imageRefTickets && data.imageRefTickets.tickets && data.imageRefTickets.tickets.length > 1 ) {
            var arrImanObj = data.imageRefTickets.tickets[ 0 ];
            var arrTickets = data.imageRefTickets.tickets[ 1 ];

            for( var i = 0; i < arrImanObj.length; i++ ) {
                var objIman = arrImanObj[ i ];

                var imageID = uidFileNameMap[ objIman.uid ];
                var ticket = arrTickets[ i ];
                _updateImage( innerHtml, imageID, ticket );
            }
            data.imageRefTickets = null;
        }
    }
};

/**
 * Prepare dataset info for creattion
 *
 * @param {Object} eventData event data
 * @returns {Object} dataset info
 */
const prepareDatasetInfo = function( eventData ) {
    const fileName = 'fakepath\\' + eventData.file.name;

    if( reqUtils.stringEndsWith( fileName.toUpperCase(), '.gif'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.png'.toUpperCase() ) ||
        reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpg'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpeg'.toUpperCase() ) ||
        reqUtils.stringEndsWith( fileName.toUpperCase(), '.bmp'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.wmf'.toUpperCase() ) ) {
        return {
            form: eventData.form,
            datasetInfo: {
                clientId: eventData.clientid,
                namedReferenceName: 'Image',
                fileName: fileName,
                name: eventData.clientid,
                type: 'Image'
            }
        };
    }
    // elsee {
    // _messagingService.reportNotyMessage( data, data._internal.messages, 'notificationForImageErrorWrongFile' );
    // }
};

// End : Image related
//Start: Edit Handler related

/**
 * function to check if view mode has been changed in diagramming context
 * @returns {boolean} viewModeChanged
 */
var viewModeChanged = function() {
    var viewModeChanged = false;
    var currentView = _.get( appCtxSvc, 'ctx.requirementDocumentation.currentViewMode', undefined );
    var nextView = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if( nextView && currentView !== nextView && ( nextView === 'SummaryView' || nextView === 'TableSummaryView' || nextView === 'TreeSummaryView' ) ) {
        viewModeChanged = true;
    }
    return viewModeChanged;
};
var _selectionChangedInPrimaryWorkArea = function() {
    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.uid === _data.uidHtmlSpecTemplate ) {
        return false;
    }
    return true;
};
/**
 * Edit Handler
 */
var editHandler = {
    // Mark this handler as native -
    isNative: true,
    _editing: false
};

/**
 *
 * @param {Object} dataSource    dataSource
 * @param {Object} startEditFunction startEdit function
 * @returns {Object} editHandler editHandler
 */
var createEditHandler = function( dataSource, startEditFunction ) {
    editHandler.getEditHandlerContext = function() {
        return HTML_SPEC_TMPL_EDIT_CONTEXT;
    };
    var _startEditFunction = startEditFunction; // provided function refs for start/save.

    /**
     * @param {String} stateName - edit state name ('starting', 'saved', 'cancelling')
     */
    function _notifySaveStateChanged( stateName ) {
        if( dataSource ) {
            switch ( stateName ) {
                case 'starting':
                    break;
                case 'saved':
                    dataSource.saveEditiableStates();
                    break;
                case 'canceling':
                    dataSource.resetEditiableStates();
                    break;
                default:
                    logger.error( 'Unexpected stateName value: ' + stateName );
            }

            editHandler._editing = stateName === 'starting';
            // Add to the appCtx about the editing state

            appCtxSvc.updateCtx( 'editInProgress', editHandler._editing );

            var context = {
                state: stateName
            };
            context.dataSource = dataSource.getSourceObject();
        }
        eventBus.publish( 'editHandlerStateChange', context );
    }

    /*Start editing*/
    editHandler.startEdit = function() {
        var defer = AwPromiseService.instance.defer();
        _startEditFunction().then( function( response ) {
            _notifySaveStateChanged( 'starting' );
            defer.resolve( response );
        }, function( err ) {
            defer.reject( err );
        } );

        //Register with leave place service
        leavePlaceService.registerLeaveHandler( {
            okToLeave: function() {
                var doingReload = true;
                return editHandler.leaveConfirmation( null, doingReload );
            }
        } );

        return defer.promise;
    };

    /**
     * Can we start editing?
     *
     * @return {Boolean} true if we can start editing
     */
    editHandler.canStartEdit = function() {
        return dataSource.canStartEdit();
    };

    /**
     * Is an edit in progress?
     *
     * @return {Boolean} true if we're editing
     */
    editHandler.editInProgress = function() {
        return false;
    };

    /**
     * @param {boolean} noPendingModifications  pending Notifications
     */
    editHandler.cancelEdits = function( noPendingModifications, doReload ) {
        leavePlaceService.registerLeaveHandler( null );
        _notifySaveStateChanged( 'canceling' );
        // Event to unregister the events & handlers
        exports.unloadContent( doReload );
        if( viewModeChanged() || doReload ) {
            // Event to load the contents
            eventBus.publish( 'requirementDocumentation.loadContentFromServer' );
        }
    };

    /*Save Edits*/
    editHandler.saveEdits = function( doReload ) {
        var deffer = AwPromiseService.instance.defer();
        var promise = exports.createUpdateContents();
        promise.then( function() {
            // Event to unregister the events & handlers
            exports.unloadContent( doReload );
            if( viewModeChanged() ) {
                // Event to load the contents
                eventBus.publish( 'requirementDocumentation.loadContentFromServer' );
            }
            if( _data.isResetPrimaryWorkAreaRequired ) {
                _data.isResetPrimaryWorkAreaRequired = false;
                eventBus.publish( 'acePwa.reset' );
            }
            deffer.resolve();
        } )
            .catch( function( error ) {
                // Event to unregister the events & handlers
                exports.unloadContent();
                deffer.reject( error );
            } );
        return deffer.promise;
    };

    /*Check if diagram IS Dirty */
    editHandler.isDirty = function() {
        return _checkCKEditorDirty( _data.requirementCtx.AWRequirementsEditor.id ) && appCtxSvc.ctx.requirementEditorContentChanged;
    };

    /**
     *
     * @param {String} label button label
     * @param {AsyncFUnction} callback callBack
     * @returns {Object} button Object
     */
    function createButton( label, callback ) {
        return {
            addClass: 'btn btn-notify',
            text: label,
            onClick: callback
        };
    }

    editHandler.getDataSource = function() {
        return dataSource;
    };

    editHandler.destroy = function() {
        dataSource = null;
    };

    //message Showing as Popup
    var displayNotificationMessage = function( doReload ) {
        //If a popup is already active just return existing promise
        if( !editHandler._deferredPopup ) {
            editHandler._deferredPopup = AwPromiseService.instance.defer();
            var message = _singleLeaveConfirmation;
            message = _singleLeaveConfirmation.replace( '{0}', appCtxSvc.ctx.selected.props.object_string.uiValues[ 0 ] );

            var buttonArray = [];
            buttonArray.push( createButton( _saveTxt, function( $noty ) {
                $noty.close();
                editHandler.saveEdits( doReload ).then( function() {
                    editHandler._deferredPopup.resolve();
                    editHandler._deferredPopup = null;
                    //incase of error
                }, function() {
                    editHandler._deferredPopup.resolve();
                    editHandler._deferredPopup = null;
                } );
            } ) );
            buttonArray.push( createButton( _discardTxt, function( $noty ) {
                $noty.close();
                editHandler.cancelEdits( true, doReload );
                editHandler._deferredPopup.resolve();
                editHandler._deferredPopup = null;
            } ) );

            notyService.showWarning( message, buttonArray );
        }

        return editHandler._deferredPopup.promise;
    };

    /**
     *   This is editHandler leaveConfirmation in which call comes for editHandlerService
     *   if viewMode Has been Changed to any of the summary view to Non summary view then directly show the PopUp
     *
     *   @param {Object} callback callBack Function
     *   @returns {leaveConfirmation}  promise Object
     */
    editHandler.leaveConfirmation = function( callback, doReload ) {
        return leaveConfirmation( callback, doReload );
    };

    /**
     * This is the common code of leaveConfirmation
     *
     * @param {Object} callback callBack Function
     * @returns {deferred.promise}  promise Object
     */
    var leaveConfirmation = function( callback, doReload ) {
        // Should not show notification if selected changed in primary workarea
        if( !_selectionChangedInPrimaryWorkArea() ) {
            if( editHandler.isDirty() ) {
                return displayNotificationMessage( doReload ).then( function() {
                    if( _.isFunction( callback ) ) {
                        callback();
                    }
                } );
            }

            if( dataSource.hasxrtBasedViewModel() && editHandler.editInProgress() ) {
                var deferred = AwPromiseService.instance.defer();
                _notifySaveStateChanged( 'saved' );
                deferred.resolve();
                return deferred.promise;
            }

            editHandler.cancelEdits( true, doReload );
            if( _.isFunction( callback ) ) {
                callback();
            }
        }
        return AwPromiseService.instance.resolve();
    };

    return editHandler;
};

/**
 * Register the edit handler
 *
 * @param {Object} data The panel's view model object
 */
var _registerEditHandler = function( data ) {
    var dataSource = dataSourceService.createNewDataSource( {
        declViewModel: data
    } );

    var startEditFunc = function() {
        var deferred = AwPromiseService.instance.defer();
        deferred.resolve( {} );
        return deferred.promise;
    };

    //create Edit Handler
    var editHandler = createEditHandler( dataSource, startEditFunc );
    //registerEditHandler
    if( editHandler ) {
        editHandlerService.setEditHandler( editHandler, HTML_SPEC_TMPL_EDIT_CONTEXT );
        editHandlerService.setActiveEditHandlerContext( HTML_SPEC_TMPL_EDIT_CONTEXT );
        editHandler.startEdit();

        if( localeService ) {
            localeService.getTextPromise( 'TCUICommandPanelsMessages' ).then(
                function( textBundle ) {
                    _singleLeaveConfirmation = textBundle.navigationConfirmationSingle;
                    _saveTxt = textBundle.save;
                    _discardTxt = textBundle.discard;
                } );
        }
    }
};
//End: Edit handler related
/**
 * load HTML Spec Template JSON
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Context object
 */
export let loadHtmlSpecTemplate = function( uidHtmlSpecTemplate ) {
    var deferred = AwPromiseService.instance.defer();

    var arrModelObjs = [ { uid: uidHtmlSpecTemplate } ];
    var cellProp = [ 'lsd', 'IMAN_specification' ];

    reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function( response ) {
        var fullTextObj = reqACEUtils.getObjectOfType( response.ServiceData.modelObjects, 'FullText' );

        if( !fullTextObj ) {
            var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
            _createFullTextOnSpecHtmlTemplate( uidHtmlSpecTemplate, jsonData );
            deferred.resolve( jsonData );
            return;
        }
        if( _data ) {
            _data.fullTextObjUid = fullTextObj.uid;
        } else {
            _data = {
                fullTextObjUid: fullTextObj.uid
            };
        }

        arrModelObjs = [ { uid: fullTextObj.uid } ];
        cellProp = [ 'body_text', 'ref_list' ];

        reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
            let jsonResult = {};
            try {
                jsonResult = JSON.parse( fullTextObj.props.body_text.dbValues[ 0 ] );
            } catch( e ) {
                // JSON parse would throw exception if the text is not a valid JSON
            }

            const bodyText = jsonResult.length > 0 ? jsonResult[ 0 ] : jsonResult;
            const typesToLoad = [];
            _getInternalTypes( bodyText, typesToLoad );
            // Load descriptors for model types, if not loaded
            soaSvc.ensureModelTypesLoaded( typesToLoad ).then( function() {
                deferred.resolve( jsonResult );
            } );
        } ).catch( function() {
            var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
            _createFullTextOnSpecHtmlTemplate( uidHtmlSpecTemplate, jsonData );
            deferred.resolve( jsonData );
        } );
    } ).catch( function() {
        var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
        _createFullTextOnSpecHtmlTemplate( uidHtmlSpecTemplate, jsonData );
        deferred.resolve( jsonData );
    } );

    return deferred.promise;
};

/**
 * Initialize HTML Spec Template content
 *
 * @param {Object} ctx - Context object
 */
export let initTreeContent = function( ctx ) {
    var deferred = AwPromiseService.instance.defer();

    exports.loadHtmlSpecTemplate( ctx.selected.uid ).then( function( response ) {
        deferred.resolve( response );
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * Initialize HTML content
 *
 * @param {Object} data The panel's view model object
 * @param {Object} requirementCtx Context object
 * @param {Boolean} ckeditorReady whether ckeditor is ready
 * @param {Object} rmHtmlSpecLocnState Html Spec Location State
 * @returns {Object} selected objects
 */
export let initContent = function (data, requirementCtx, ckeditorReady, rmHtmlSpecLocnState) {
    let returnValue;
    appCtxSvc.registerCtx('visibleMoveCommandsForHTMLSpecTemplate', false);
    if (_data.fullTextObjUid) {
        data.fullTextObjUid = _data.fullTextObjUid;
    }
    _data = data;

    var jsonData = data.htmlSpecTmplResponse.length > 0 ? data.htmlSpecTmplResponse[0] : data.htmlSpecTmplResponse;
    data.HTML_SPEC_TEMPLATE_CONTENT = jsonData;
    const rmHtmlSpecLocnStateValue = { ...rmHtmlSpecLocnState.value };
    rmHtmlSpecLocnStateValue.HTML_SPEC_TEMPLATE_CONTENT = jsonData;
    rmHtmlSpecLocnState.update(rmHtmlSpecLocnStateValue);
    data.showCKEditor = true;

    eventBus.publish('importPreview.refreshTreeDataProvider');

    data.HTML_CONTENT = '';

    // Get the contents that set it in the data
    _getHtmlSpecTemplateJson(data, jsonData, '', '');

    returnValue = {};
    if (ckeditorReady) {
        if (!_.get(data, 'requirementCtx.AWRequirementsEditor.id')) {
            _.set(data, 'requirementCtx.AWRequirementsEditor.id', requirementCtx.value.AWRequirementsEditor.id);
        }
        // If ckeditor is ready, set contents
        _preprocessContentsAndSetToEditor(data);
        // Register edit handler
        _registerEditHandler(data);
        _resetUndoOfCkeditor(data);

        const selectedObjectUid = [];
        selectedObjectUid.push(data.uidHtmlSpecTemplate);
        const ckEditorId = _.get(data, 'requirementCtx.AWRequirementsEditor.id', requirementCtx.value.AWRequirementsEditor.id);
        setTimeout(function () {
            ckeditorOperations.scrollCKEditorToGivenObject(ckEditorId, selectedObjectUid);
        }, 3000);

        returnValue.selectedObjectUid = selectedObjectUid;

        eventBus.publish('requirementDocumentation.DocTabLoaded');

    } else {

        // If not, set flat to indicate that content is ready to set
        returnValue.contentReady = true;
        data.dispatch({ path: 'data.contentReady', value: returnValue.contentReady });

    }
    return returnValue;

};


const _getInternalTypes = function( jsonData, internalTypes ) {
    if( !_.isEmpty( jsonData ) ) {
        internalTypes.push( jsonData.internalType );
        for( let index = 0; index < jsonData.children.length; index++ ) {
            _getInternalTypes( jsonData.children[ index ], internalTypes );
        }
    }
};
/**
 * Pre-process the contetns and set it to editor
 * @param {Object} data - view model object data
 */
var _preprocessContentsAndSetToEditor = function( data ) {
    appCtxSvc.updatePartialCtx( 'AWRequirementsEditor.editor.isHtmlSpecTemplate', true );

    var htmlContent = data.HTML_CONTENT;

    var elementChild = document.createElement( 'div' );
    elementChild.innerHTML = htmlContent;
    data.hideTracelink = true;
    data.removeWidgets = true;
    reqACEUtils.updateMarkers( elementChild, data );
    _setCKEditorContent( data.requirementCtx.AWRequirementsEditor.id, elementChild.innerHTML );
};

export default exports = {
    createUpdateContents,
    cancelEdits,
    moveUp,
    moveDown,
    promote,
    demote,
    isCkeditorInstanceReady,
    selectionChanged,
    unloadContent,
    updateFormData,
    insertImage,
    updateImages,
    loadHtmlSpecTemplate,
    initTreeContent,
    initContent,
    prepareDatasetInfo
};
