// Copyright (c) 2022 Siemens

/**
 * @module js/Arm1PasteOperationService
 */
import appCtxService from 'js/appCtxService';
import addElementService from 'js/addElementService';
import cdm from 'soa/kernel/clientDataModel';
import ClipboardService from 'js/clipboardService';
import eventBus from 'js/eventBus';
import viewModelObjectService from 'js/viewModelObjectService';
import messagingService from 'js/messagingService';
import aceDefaultPasteHandler from 'js/aceDefaultPasteHandler';
import AwPromiseService from 'js/awPromiseService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import contextStateMgmtService from 'js/contextStateMgmtService';


var exports = {};
var _currentScope = null;

/**
 * Adds intent for pasting object
 */
var addIntentForPaste = function( addElementInput ) {
    if ( appCtxService.ctx.cutIntent && appCtxService.ctx.cutIntent === true ) {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'MoveIntent';
    } else {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'paste';
    }

    if ( appCtxService.ctx.aceActiveContext.context.addObjectIntent ) {
        if ( appCtxService.ctx.aceActiveContext.context.addObjectIntent === 'MoveIntent' ) {
            addElementInput.addObjectIntent = 'MoveIntent';
            delete appCtxService.ctx.aceActiveContext.context.addObjectIntent;
        } else if ( appCtxService.ctx.aceActiveContext.context.addObjectIntent === 'paste' ) {
            addElementInput.addObjectIntent = '';
            delete appCtxService.ctx.aceActiveContext.context.addObjectIntent;
        }
    } else { addElementInput.addObjectIntent = 'DragAndDropIntent'; }
};

/**
 * Paste object as child. Pastes the objects in clipboard as child to the selected object.
 *
 */
export let pasteObjectAsChild = function() {
    var addElementInput = {};
    var clipboardObjects = ClipboardService.instance.getContents();

    addIntentForPaste( addElementInput );

    appCtxService.ctx.occmgmtContext = appCtxService.ctx.occmgmtContext || {};
    appCtxService.ctx.occmgmtContext.addElementInput = addElementInput;
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
    addElementService.processAddElementInput();
    _addElement( clipboardObjects );
};

/**
 * Paste object as sibling. Paste the objects in clipboard as sibling to the selected object.
 *
 */
export let pasteObjectAsSibling = function() {
    var addElementInput = {};
    var clipboardObjects = ClipboardService.instance.getContents();

    addIntentForPaste( addElementInput );
    addElementInput.parentElement = viewModelObjectService
        .createViewModelObject( appCtxService.ctx.selected.props.awb0Parent.dbValues[ 0 ] );
    addElementInput.siblingElement = appCtxService.ctx.selected;

    appCtxService.ctx.occmgmtContext = appCtxService.ctx.occmgmtContext || {};
    appCtxService.ctx.occmgmtContext.addElementInput = addElementInput;
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
    addElementService.processAddElementInput();
    _addElement( clipboardObjects );
};


var _addElement = function( sourceObjects ) {
    var deferred = AwPromiseService.instance.defer();
    let targetObject = appCtxService.ctx.aceActiveContext.context.addElement.parent;

    aceDefaultPasteHandler.addElement( sourceObjects, targetObject ).then(
        ( response ) => {
            if ( response.ServiceData && response.ServiceData.partialErrors ) {
                let combinedError = '';
                let maxErrorLevel = 0;
                response.ServiceData.partialErrors.map( partialError => {
                    if ( partialError && partialError.errorValues ) {
                        partialError.errorValues.map( ( error, i ) => {
                            if ( error.code ) {
                                combinedError += error.message + ( i === 0 ? '' : '<BR>' );
                            }
                            if( maxErrorLevel < error.level ) {
                                maxErrorLevel = error.level;
                            }
                        } );
                    }
                } );

                if( maxErrorLevel >= 2 ) {
                    messagingService.showError( combinedError );
                } else {
                    messagingService.showInfo( combinedError );
                }
            }

            deferred.resolve();
        },
        ( err ) => {
            if ( err ) {
                var errMsg = messagingService.getSOAErrorMessage( err );
                messagingService.showError( errMsg );
            }
            deferred.reject( err );
        }
    );
};

self.getObject = function( object ) {
    return {
        uid: object.uid,
        type: object.type
    };
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @param {Object} data - The panel's view model object
 * @returns {Object} - Json object
 */
export let getReuseRequirementsInput = function( data ) {
    var prefixTextBox = '';
    var suffixTextBox = '';
    var replaceTextBox = '';
    var withTextBox = '';
    var runInBackgroundCheckBox = data.runInBackgroundCheckBox.dbValue;
    var defaultIdsOrIdNamingRuleCheckBox = data.defaultIdsOrIdNamingRuleCheckBox.dbValue;

    if( defaultIdsOrIdNamingRuleCheckBox === false ) {
        prefixTextBox = data.prefixTextBox.dbValue;
        suffixTextBox = data.suffixTextBox.dbValue;
        replaceTextBox = data.replaceTextBox.dbValue;
        withTextBox = data.withTextBox.dbValue;
    }

    var panelContext = appCtxService.getCtx( 'panelContext' );
    var target;
    var source;
    if( panelContext && panelContext.sourceObject && panelContext.targetObject ) {
        target = panelContext.targetObject;
        source = panelContext.sourceObject;
    } else {
        target = appCtxService.getCtx( 'selected' );
        source = ClipboardService.instance.getContents();
    }

    var prodCtxt = self.getObject( occMgmtStateHandler.getProductContextInfo() );
    var parentChildren = [];
    var targetParent = [];
    var siblingElement = [];
    for( let index = 0; index < source.length; index++ ) {
        parentChildren.push( { parent: self.getObject( source[index] ) } );
    }
    if( panelContext.pasteId === 'CHILD' ) {
        targetParent = self.getObject( target );
    } else if( panelContext.pasteId === 'SIBLING' ) {
        siblingElement = [ self.getObject( target ) ];
        targetParent = self.getObject( viewModelObjectService
            .createViewModelObject( target.props.awb0Parent.dbValues[ 0 ] ) );
    }
    return {
        productContextInfo:prodCtxt,
        parentAndItsChildren:parentChildren,
        targetParents: [ targetParent ],
        siblingElements:siblingElement,
        namePattern:{
            autogen:defaultIdsOrIdNamingRuleCheckBox,
            fromString:replaceTextBox,
            toString:withTextBox,
            prefix:prefixTextBox,
            suffix:suffixTextBox
        },
        isRunInBackground:runInBackgroundCheckBox,
        options:[]
    };
};
export let pasteObjectInput = function( input ) {
    const { commandContext } = input;
    const { dialogAction } = commandContext;
    if( input.commandId ) {
        if( dialogAction ) {
            let options = {
                view: input.commandId,
                parent: '.aw-layout-workareaMain',
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false,
                subPanelContext: input.commandContext
            };
            dialogAction.show( options );
            appCtxService.registerCtx( 'panelContext', input.panelContext );
        }
    }
};
/**
 * Get children Occurrences
 * @param {String} id context key of the view
 *@return {Object} children Occurrences
 */
let _getChildOccurrence = function( id ) {
    return {
        occurrenceId: id,
        occurrence: cdm.getObject( id )
    };
};

/**
 *
 * @param {*} created
 * @param {*} parent
 * @param {*} pasteCopySoaResponse
 * @returns
 */
function _getAddElementData( created, parent, pasteCopySoaResponse ) {
    var childOccInfo = pasteCopySoaResponse.parentChildNodes;
    var serviceData = pasteCopySoaResponse.ServiceData;

    var aceActiveContext = appCtxService.getCtx( 'aceActiveContext' );
    var contextKey = aceActiveContext.key;
    var reloadContent = false;
    var newElements = [ created.uid ];
    var newElementsParent = cdm.getObject( parent.uid );

    let objectsToSelect = [];
    let childOccurrences = [];
    let addElementInput = {};
    addElementInput.parent = newElementsParent;
    for( let i = 0; i <= newElements.length - 1; i++ ) {
        objectsToSelect.push( cdm.getObject( newElements[ i ] ) );
    }
    for( let i = 0; i <= childOccInfo.length - 1; i++ ) {
        if( childOccInfo[ i ].parent.uid === parent.uid ) {    // Add objects with same parent
            for( let j = 0; j < childOccInfo[ i ].children.length; j++ ) {
                childOccurrences.push( _getChildOccurrence( childOccInfo[ i ].children[j].uid ) );
            }
        }
    }

    let addElementResponse = {
        reloadContent: reloadContent,
        selectedNewElementInfo: {
            newElements: objectsToSelect,
            pagedOccurrencesInfo: {
                childOccurrences: childOccurrences
            }
        },
        newElementInfos: objectsToSelect,
        ServiceData: serviceData
    };

    return {
        objectsToSelect: objectsToSelect,
        addElementResponse: addElementResponse,
        addElementInput: addElementInput,
        viewToReact: contextKey,
        skipDocTabRefresh: true
    };
}

export let addCreatedObjectInTreeAfterPaste = function( pasteCopySoaResponse ) {
    if( pasteCopySoaResponse && pasteCopySoaResponse.newElements ) {
        var created = pasteCopySoaResponse.newElements[0];
        created = cdm.getObject( created.uid );
        if( created ) {
            var parent = pasteCopySoaResponse.targetParents[0];
            eventBus.publish( 'addElement.elementsAdded', _getAddElementData( created, parent, pasteCopySoaResponse ) );
            eventBus.publish( 'aceElementsSelectedEvent', { elementsToSelect: created } );
        }
    }
};

/**
 * Here we are activating target view before proceeding for DnD operation.
 *
 * @param{ModelObject} targetObject Parent to which the object is to be pasted
 * @param{Array} Source objects array that need to be moved or pasted
 */
export let arm0updateCtxForAddUsingDragDrop = function( targetObject ) {
    var viewKeys = appCtxService.ctx.splitView ? appCtxService.ctx.splitView.viewKeys : [];
    for( var i = 0; i < viewKeys.length; i++ ) {
        var vmoID = appCtxService.ctx[ viewKeys[ i ] ].vmc.findViewModelObjectById( targetObject.uid );
        if( vmoID !== -1 ) {
            contextStateMgmtService.updateActiveContext( viewKeys[ i ] );
            break;
        }
    }

    appCtxService.updatePartialCtx( 'aceActiveContext', appCtxService.ctx.aceActiveContext ? appCtxService.ctx.aceActiveContext : {} );
};

/** Bydefault With text box is disable after inserting text in replace box it should be enable  */
export let initializeValues = function( data ) {
    let isEditable = false;
    if( data.replaceTextBox.dbValue.length > 0 ) {
        isEditable = true;
    }
    return isEditable;
};
