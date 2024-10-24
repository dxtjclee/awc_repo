// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/moveCommandsRequirement
 */
import reqACEUtils from 'js/requirementsACEUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

var PAGE_SIZE = 3;

/**
 * Get Input context for move operation.
 */
export let getInputContext = function() {
    return reqACEUtils.getInputContext();
};

/**
 * Set Move operation type.
 *
 * @param {IModelObject} selectedObject - The selected object.
 */
export let setMoveOperationType = function( data, operationType ) {
    data.operationType = operationType;
};

/**
 * Move up operation move selected element one position up in same level of hierarchy
 */
export let MoveUpHtmlSpecTemplateAndPreview = function() {
    eventBus.publish( 'Arm0HTMLSpecTemplateEditAndPreview.MoveUp' );
};

/**
 * Move down operation move selected element one position below in same level of hierarchy
 */
export let MoveDownHtmlSpecTemplateAndPreview = function() {
    eventBus.publish( 'Arm0HTMLSpecTemplateEditAndPreview.MoveDown' );
};

/**
 * Promote operation move selected element to parent level of hierarchy
 */
export let PromoteHtmlSpecTemplateAndPreview = function() {
    eventBus.publish( 'Arm0HTMLSpecTemplateEditAndPreview.Promote' );
};

/**
 * Demote operation move selected element to its sibling's children  hierarchy
 */
export let DemoteHtmlSpecTemplateAndPreview = function() {
    eventBus.publish( 'Arm0HTMLSpecTemplateEditAndPreview.Demote' );
};

/**
 * Call SOA for moveSelectedOccurrences with Property Policy Override
 *
 * @param {Object} inputData Input Data for SOA call
 * @param {Object} propertyPolicyOverride Property Policy
 * @returns {Object} - Json object
 */
export let moveSelectedOccurrences = function( inputData ) {
    var headerStateOverride = { usePolicyOnly:true };
    var propertyPolicyOverride = {
        types: [
            {
                name: 'Arm0RequirementElement',
                properties: [ {
                    name: 'arm1ParaNumber'
                },
                {
                    name: 'awb0Parent'
                },
                {
                    name: 'awb0UnderlyingObject'
                },
                {
                    name: 'object_string'
                },
                {
                    name: 'awb0NumberOfChildren'
                } ]
            },
            {
                name: 'Arm0ParagraphElement',
                properties: [ {
                    name: 'arm1ParaNumber'
                },
                {
                    name: 'awb0Parent'
                },
                {
                    name: 'awb0UnderlyingObject'
                },
                {
                    name: 'object_string'
                },
                {
                    name: 'awb0NumberOfChildren'
                } ]
            },
            {
                name: 'Arm0RequirementSpecElement',
                properties: [ {
                    name: 'arm1ParaNumber'
                },
                {
                    name: 'awb0Parent'
                },
                {
                    name: 'awb0UnderlyingObject'
                },
                {
                    name: 'object_string'
                },
                {
                    name: 'awb0NumberOfChildren'
                } ]
            }
        ]
    };
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceReqMgmt-2017-06-SpecNavigation', 'moveSelectedOccurrences', inputData, propertyPolicyOverride, false, headerStateOverride );
};

export let addMovedObjectInTree = function( data ) {
    if( data.operationType === 1 || data.operationType === 2 ) {
        // Move Up, down
        exports.addCreatedObjectInTreeAfterMoveUpDown( data );
    } else {
        // Promote, Demote
        exports.addCreatedObjectInTreeAfterPromoteDemote( data );
    }
};

export let addCreatedObjectInTreeAfterPromoteDemote = function( data ) {
    var moveOccResponse = data.moveOccSoaResponse;
    var created = moveOccResponse.ServiceData.created[0];
    created = cdm.getObject( created );
    var parent = created.props.awb0Parent.dbValues[0];
    eventBus.publish( 'addElement.elementsAdded', _getAddElementData( created, parent, moveOccResponse ) );

    eventBus.publish( 'aceElementsSelectedEvent', { elementsToSelect: [created] } );
};

export let addCreatedObjectInTreeAfterMoveUpDown = function( data ) {
    var oldMovedObject = data.newSelectedObject ? data.newSelectedObject : appCtxSvc.ctx.selected;
    var moveOccResponse = data.moveOccSoaResponse;

    eventBus.publish( 'cdm.deleted', {
        deletedObjectUids: [ oldMovedObject.uid ]
    } );

    setTimeout( () => {
        var parent = oldMovedObject.props.awb0Parent.dbValues[0];
        eventBus.publish( 'addElement.elementsAdded', _getAddElementData( oldMovedObject, parent, moveOccResponse ) );
    }, 100 );
};

/**
 * Get children Occurrences
 * @param {String} contextKey context key of the view
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
 * @returns
 */
function _getAddElementData( created, parent, moveOccResponse ) {
    var childOccInfo = moveOccResponse.newElementInfos;
    var serviceData = moveOccResponse.ServiceData;

    var contextKey = appCtxSvc.ctx.aceActiveContext.key;
    var reloadContent = false;
    var newElements = [ created.uid ];
    var newElementsParent = cdm.getObject( parent );

    let objectsToSelect = [];
    let childOccurrences = [];
    let addElementInput = {};
    addElementInput.parent = newElementsParent;
    for( let i = 0; i <= newElements.length - 1; i++ ) {
        if( childOccInfo[ i ].parentElement.uid === parent ) {    // Add objects with same parent
            objectsToSelect.push( cdm.getObject( newElements[ i ] ) );
        }
    }
    for( let i = 0; i <= childOccInfo.length - 1; i++ ) {
        childOccurrences.push( _getChildOccurrence( childOccInfo[ i ].childElement.uid ) );
    }

    let addElementResponse = {
        reloadContent: reloadContent,
        selectedNewElementInfo: {
            newElements: objectsToSelect,
            pagedOccurrencesInfo: {
                childOccurrences: childOccurrences
            }
        },
        newElementInfos: [],
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

export default exports = {
    getInputContext,
    setMoveOperationType,
    MoveUpHtmlSpecTemplateAndPreview,
    MoveDownHtmlSpecTemplateAndPreview,
    PromoteHtmlSpecTemplateAndPreview,
    DemoteHtmlSpecTemplateAndPreview,
    moveSelectedOccurrences,
    addMovedObjectInTree,
    addCreatedObjectInTreeAfterPromoteDemote,
    addCreatedObjectInTreeAfterMoveUpDown
};
