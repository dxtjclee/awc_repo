// Copyright (c) 2022 Siemens

/**
 * @module js/senAssignPartsHandler
 */
import addElementService from 'js/addElementService';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';


let singleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded === 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'elementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let multipleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded > 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'multipleElementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let showInfo = function( meta ) {
    localeService.getLocalizedText( meta.path, meta.key ).then( function( localizedMessage ) {
        let message = messagingService.applyMessageParams( localizedMessage, meta.params, meta.context );
        messagingService.showInfo( message );
    } );
};

let postProcessAddObject = function( inputData, addElementInput ) {
    let eventData = {
        objectsToSelect: addElementService.getAddElementResponse( inputData.addElementResponse ).newlyAddedChildElements,
        addElementResponse: inputData.addElementResponse,
        addElementInput: addElementInput,
        viewToReact: 'sbomContext'
    };
    eventBus.publish( 'addElement.elementsAdded', eventData );
    const eventDataElementsSelectionUpdated = {
        objectsToSelect: eventData.objectsToSelect,
        viewToReact: 'sbomContext'
    };
    eventBus.publish( 'aceElementsSelectionUpdatedEvent', eventDataElementsSelectionUpdated );
};

let createAddObjectInput = function( sourceObjects, context, addElementInput ) {
    let soaInput = {};
    soaInput.input = {};
    soaInput.input.objectsToBeAdded = addElementService.getElementsToAdd( '', '', sourceObjects );
    soaInput.input.fetchPagedOccurrences = true;
    soaInput.input.parentElement = addElementInput.parent;
    soaInput.input.inputCtxt = {
        productContext: context.productContextInfo
    };
    soaInput.input.sortCriteria = {
        propertyName: context.sortCriteria ? context.sortCriteria[ 0 ].fieldName : undefined,
        sortingOrder: context.sortCriteria ? context.sortCriteria[ 0 ].sortDirection : undefined
    };
    soaInput.input.addObjectIntent = addElementInput.addObjectIntent;
    soaInput.input.requestPref = {
        displayMode: [ addElementService.getDisplayMode() ]
    };
    soaInput.input.numberOfElements = 1;
    return soaInput;
};

export let assignFromEbomToSbom = function( sourceObjects, targetObject, context ) {
    let totalObjectsAdded;
    let inputData = {};
    let addElementInput = {};
    addElementInput.parent = targetObject;
    addElementInput.addObjectIntent = 'MfgDragAndDropIntent';

    let soaInput = createAddObjectInput( sourceObjects, context, addElementInput );
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'addObject3', soaInput ).then( function( response ) {
        let err;
        inputData.addElementResponse = response;
        totalObjectsAdded = addElementService.getTotalNumberOfChildrenAdded( response );
        if( totalObjectsAdded > 0 || response.ServiceData.partialErrors ) {
            if( response.ServiceData.partialErrors ) {
                err = soaSvc.createError( response.ServiceData );
                let errMessage = messagingService.getSOAErrorMessage( err );
                messagingService.showError( errMessage );
            }
            postProcessAddObject( inputData, addElementInput );
        }
        let msgContext = {
            totalObjectsAdded: totalObjectsAdded,
            selectedObjectString: _.get( response, 'selectedNewElementInfo.newElements[0].props.object_string.dbValues[0]' ),
            parentObjectString: _.get( targetObject, 'props.object_string.dbValues[0]' )
        };

        singleElementAddSuccessful( msgContext, [ '{{selectedObjectString}}', '{{parentObjectString}}' ] );
        multipleElementAddSuccessful( msgContext, [ '{{totalObjectsAdded}}', '{{parentObjectString}}' ] );
    } );
};

export default {
    assignFromEbomToSbom
};
