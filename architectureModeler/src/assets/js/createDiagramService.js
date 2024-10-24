// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global define */

/**
 * @module js/createDiagramService
 */
import addObjectUtils from 'js/addObjectUtils';
import selectionService from 'js/selection.service';
import viewModelObjectService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

var exports = {};

var _data = null;

/**
 * Return create input for create diagram operation.
 *
 * @param {Object} data - The panel's view model object
 */
export let getCreateInput = function( data, creationType, occContext, editHandler ) {
    var selection = selectionService.getSelection().selected;
    var createInput = addObjectUtils.getCreateInput( data, null, creationType, editHandler );

    createInput[ 0 ].createData.propertyNameValues.awb0SourceAutoBookmark = [ occContext.productContextInfo.props.awb0AutoBookmark.dbValues[ 0 ] ];

    var input = [];
    var inputData = {
        clientId: 'createDiagram',
        userAction: 'CreateDiagram',
        primaryObjects: selection,
        secondaryObjects: [],
        createInput: createInput[ 0 ].createData,
        inputCtxt: {
            productContext: occContext.productContextInfo
        }
    };

    input.push( inputData );

    return input;
};

/**
 * Get created object. Return ItemRev if the creation type is Item.
 * @param {Object} response the response of createRelateAndSubmitObjects SOA call
 * @returns {Object} object diagram Object
 */
export let getCreatedObject = function( response ) {
    var object = null;
    if( response && response.ServiceData.created[ 0 ] ) {
        var newObjectUid = response.ServiceData.created[ 0 ];
        if( viewModelObjectService ) {
            object = viewModelObjectService.createViewModelObject( newObjectUid, 'EDIT' );
        }
    } else {
        logger.error( 'CreateDiagram:ERROR - during create new diagram.' );
    }

    return object;
};

var clearSelectedType = function() {
    if( _data ) {
        _data.creationType = null;
    }
};

export let initNavigateFunction = function( data ) {
    _data = data;
    data.clearSelectedType = clearSelectedType;
    eventBus.publish( 'StartSaveAutoBookmarkEvent' );
};

/**
 * Fires events to signify the success of diagram creation
 *@param{Object} data viewmodel object
 */
export let processCreateDiagramSuccess = function( data ) {
    var closeSubPanelEvent = {
        source: 'createDiagramSub'
    };
    eventBus.publish( 'complete.subPanel', closeSubPanelEvent );

    var toOpenDiagram = false;
    if( data.openOnCreate.dbValue === true ) {
        toOpenDiagram = true;

        // below publish even will add the diagram in interacted product and getOcc SOA will get called with restore mode.
        var eventData = {
            createdObject: data.createdObject
        };
        eventBus.publish( 'swc.objectCreated',  eventData );
    }

    var createDiagramSuccessEvent = {
        diagramUid: data.createdObject.uid,
        toOpen: toOpenDiagram
    };
    eventBus.publish( 'CreateDiagramSub.CreateDiagramProcessSuccess', createDiagramSuccessEvent );
};

export let navigateAndCreateInput = function( data ) {
    data.clearSelectedType = clearSelectedType;

    if( !data.eventData && data.creationType ) {
        return;
    }
    if( data.eventData && data.eventData.selectedObjects ) {
        if( data.eventData.selectedObjects.length === 0 ) {
            if( data.dataProviders.awTypeSelector &&
                data.dataProviders.awTypeSelector.selectedObjects.length === 1 ) {
                data.creationType = data.dataProviders.awTypeSelector.selectedObjects[ 0 ];
            }
        } else {
            data.creationType = data.eventData.selectedObjects[ 0 ].props ? data.eventData.selectedObjects[ 0 ] : data.eventData.selectedObjects[ 0 ].object;
            if( data.creationType.props.type_name.uiValue !== 'undefined' ) {
                data.creationType.props.type_name.propertyDisplayName = data.creationType.props.type_name.uiValue;
            }
        }
    } else {
        data.creationType = null;
    }

    // clear the event data. This is needed to ensure updateDeclModel does not go in recursion
    data.eventData = null;
};

/**
 * Return an Object of createDiagramService
 *
 * @member of NgServices
 */

export default exports = {
    getCreateInput,
    getCreatedObject,
    initNavigateFunction,
    processCreateDiagramSuccess,
    navigateAndCreateInput
};
