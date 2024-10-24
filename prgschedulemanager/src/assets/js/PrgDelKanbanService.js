// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import { getBaseUrlPath } from 'app';
import awIconService from 'js/awIconService';
import awKanbanUtils from 'js/AwKanbanUtils';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import PrgDelKanbanViewCallbacks from 'js/PrgDelKanbanViewCallbacks';
import uwPropSvc from 'js/uwPropertyService';

var exports = {};

export let initializeKanbanColumns = ( kanbanColumns, atomicDataRef, kanbanId, selectionData, i18n ) => {
    let kanbanColumnObject = {};
    if( kanbanColumns ) {
        kanbanColumns.forEach( ( column ) => {
            let displayName = column.displayName;
            if( displayName ) {
                let localizedDispName = i18n[ displayName ];
                if( localizedDispName ) {
                    column.displayName = localizedDispName;
                }
            }
        } );
        kanbanColumnObject = awKanbanUtils.buildKanbanColumns( kanbanColumns );
    }
    let kanbanProps = { atomicDataRef: atomicDataRef, kanbanId: kanbanId, selectionData: selectionData };
    let prgDelKanbanViewCallbacks = new PrgDelKanbanViewCallbacks( kanbanProps );
    return {
        kanbanColumnObject: kanbanColumnObject,
        callbacks: prgDelKanbanViewCallbacks
    };
};

export let parseKanbanSOAResponse = function( response, data, kanbanState ) {
    let loadedObjs = [];
    _.forEach( response.searchResults, function( result ) {
        let resultObject = cdm.getObject( result.uid );
        if( resultObject ) {
            let kanbanBoardObj = constructKanbanBoardObj( resultObject, data );
            if( !_.isEmpty( kanbanBoardObj ) ) {
                loadedObjs.push( kanbanBoardObj );
            }
        }
    } );

    let atomicData = kanbanState.getAtomicData();
    atomicData.loadedObjects = loadedObjs;
    return atomicData;
};
let constructKanbanBoardObj = function( kanbanObj, data ) {
    if( !_.isEmpty( kanbanObj.props ) ) {
        let status = kanbanObj.props.psi0State.dbValues[ 0 ];
        if( !status ) {
            //Assigning it to 'null' as by giving null its showing all the cards in 'unassigned' lane
            status = 'null';
        }
        let cssClass = 'aw-prgSchedulemanager-kanbanBoardCard aw-aria-border';
        let cellProps = kanbanObj.props.awp0CellProperties.uiValues;
        let kanbanCardProps = [];
        let kanbanCardPropValues = [];
        let values;
        let valueProp;
        if( !_.isEmpty( cellProps ) ) {
            for( let prop = 0; prop < cellProps.length; prop++ ) {
                if( prop === 0 ) {
                    values = cellProps[prop].split( '\\:' );
                    valueProp = '<strong>' + values[ 1 ] + '</strong>';
                } else {
                    values = cellProps[prop].split( '\\:' );
                    valueProp = '<strong>' + values[ 0 ] + ': </strong>' + values[ 1 ];
                }
                kanbanCardProps.push( valueProp );
                kanbanCardPropValues.push( values[ 1 ] );
            }
        } else {
            let objString = '<strong>' + kanbanObj.props.object_string.uiValues[ 0 ] + ' </strong>';
            let itemId = '<strong>' + kanbanObj.props.item_id.propertyDescriptor.displayName + ': </strong>' + kanbanObj.props.item_id.uiValues[ 0 ];
            let revision = '<strong>' + kanbanObj.props.item_revision_id.propertyDescriptor.displayName + ': </strong>' + kanbanObj.props.item_revision_id.uiValues[ 0 ];
            let dueDate = '<strong>' + kanbanObj.props.psi0DueDate.propertyDescriptor.displayName + ': </strong>' + kanbanObj.props.psi0DueDate.uiValues[ 0 ];
            let percentComplete = '<strong>' + kanbanObj.props.psi0PercentComplete.propertyDescriptor.displayName + ': </strong>' + kanbanObj.props.psi0PercentComplete.uiValues[ 0 ];
            let instanceCount = '<strong>' + kanbanObj.props.psi0InstanceCount.propertyDescriptor.displayName + ': </strong>' + kanbanObj.props.psi0InstanceCount.uiValues[ 0 ];
            kanbanCardProps = [ objString, itemId, revision, dueDate, percentComplete, instanceCount ];
            let nameValue =  kanbanObj.props.object_string.uiValues[ 0 ];
            let itemIdValue = kanbanObj.props.item_id.uiValues[ 0 ];
            let revisionValue = kanbanObj.props.item_revision_id.uiValues[ 0 ];
            let dueDateValue = kanbanObj.props.psi0DueDate.uiValues[ 0 ];
            let percentValue = kanbanObj.props.psi0PercentComplete.uiValues[ 0 ];
            let instanceCountValue = kanbanObj.props.psi0InstanceCount.uiValues[ 0 ];

            kanbanCardPropValues = [ nameValue, itemIdValue, revisionValue, dueDateValue, percentValue, instanceCountValue ];
        }
        let iconURL = awIconService.getTypeIconFileUrl( kanbanObj );
        let iconTooltip = kanbanObj.props.object_type.uiValues[ 0 ];
        let iconRightTooltip = data.i18n.Psi0OpenPrgObjectCellCommandDesc;
        let iconRightTitle = data.i18n.open;

        return {
            id: kanbanObj.uid,
            status: status,
            text: '',
            tags: kanbanCardProps,
            tagValues: kanbanCardPropValues,
            $css: cssClass,
            iconURL: iconURL,
            iconTooltip: iconTooltip,
            showRightIcon: true,
            iconRightTooltip: iconRightTooltip,
            iconRightTitle: iconRightTitle
        };
    }
};

var getKanbanColumnObj = function() {
    return {
        name: '',
        displayName: '',
        isGroup: false,
        multiselect: true
    };
};

export let constructKanbanColumns = function( response, data ) {
    let kanbanColumns = [];
    if( data.fetchNullValues === 'true' ) {
        let kanbanNullObj = getKanbanColumnObj();
        kanbanNullObj.name = 'null';
        kanbanNullObj.displayName = data.i18n.unassignedKanbanColumn;
        kanbanColumns.push( kanbanNullObj );
    }
    for( var i = 0; i < response.lovValues.length; i++ ) {
        let kanbanObj = getKanbanColumnObj();
        kanbanObj.name = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        kanbanObj.displayName = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        kanbanColumns.push( kanbanObj );
    }
    return kanbanColumns;
};

export let createKanbanPropertyString = function( response ) {
    let lovValueString = 'psi0State:';
    let lovValueArray = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        lovValueArray.push( response.lovValues[ i ].propInternalValues.lov_values[ 0 ] );
    }
    lovValueArray.join( ',' );
    return lovValueString.concat( lovValueArray );
};

export let prepareDataForSaveEdit = function( kanbanState, lsd ) {
    let inputs = [];
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        let dragDropContext = kanbanState.operation.value;
        let draggedObjectUidArray = dragDropContext.dragContext.source;
        let statusToUpdate = dragDropContext.dragContext.to.config.status;
        let stateToUpdate = kanbanState.kanbanColumnObject.columnMapping[ statusToUpdate ];
        draggedObjectUidArray.forEach( function( objUid ) {
            let draggedObject = cdm.getObject( objUid );
            if( draggedObject ) {
                let stateProp = uwPropSvc.createViewModelProperty( 'psi0State', 'State', 'STRING',
                    stateToUpdate, '' );
                stateProp.sourceObjectLastSavedDate = lsd;
                let editObject = dms.getSaveViewModelEditAndSubmitToWorkflowInput( draggedObject );
                dms.pushViewModelProperty( editObject, stateProp );
                inputs.push( editObject );
                if( statusToUpdate === 'Complete' ) {
                    let percentProp = uwPropSvc.createViewModelProperty( 'psi0PercentComplete', 'Percent Complete', 'INTEGER',
                        100, '' );
                    percentProp.sourceObjectLastSavedDate = lsd;
                    let editedObject = dms.getSaveViewModelEditAndSubmitToWorkflowInput( draggedObject );
                    dms.pushViewModelProperty( editedObject, percentProp );
                    inputs.push( editedObject );
                }
            }
        } );
    }
    return inputs;
};

let updateOperationAtomicData = ( atomicDataRef, actionName, value ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    atomicDataDestructured.operation = {
        action: actionName,
        value: value
    };
    atomicDataRef.setAtomicData( atomicDataDestructured );
};

export const revertPDRKanbanCardDragDrop = ( atomicDataRef ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    updateOperationAtomicData( atomicDataRef, 'dragDropCardFailure', atomicDataDestructured.operation.value );
};

export let createInputForLoadEditing = function( kanbanState ) {
    var inputs = [];
    var properties = [];

    let dragDropContext = kanbanState.operation.value;
    let draggedObjectUid = dragDropContext.dragContext.source;
    let draggedObject = cdm.getObject( draggedObjectUid );

    properties.push( 'psi0State' );

    var input = {
        objs: [ draggedObject ],
        propertyNames: properties,
        isPessimisticLock: false
    };

    inputs.push( input );
    return inputs;
};

export let extractSrcObjsLSD = function( response ) {
    let modelObjects = [];
    let lsd = null;
    if( response.viewModelObjectsJsonStrings && response.viewModelObjectsJsonStrings.length > 0 ) {
        modelObjects = JSON.parse( response.viewModelObjectsJsonStrings[ 0 ] ).objects;
        if( modelObjects.length > 0 ) {
            lsd = modelObjects[ 0 ].props[ Object.keys( modelObjects[ 0 ].props )[ 0 ] ].srcObjLsd;
        }
    }
    return lsd;
};

export let getDisplayLimitFromPreference = function() {
    let prefValue = appCtxSvc.getCtx( 'preferences.AWC_Kanban_Board_Display_Limit' );
    return prefValue.toString();
};

export let getSortingOrderFromPreference = function() {
    let sortingProps = appCtxSvc.getCtx( 'preferences.AWC_Kanban_Board_Sort_Order' );
    let idx = sortingProps.findIndex( element => element.includes( 'Psi0PrgDelRevision' ) );
    let prefValue = sortingProps[ idx ];
    let propValues = prefValue.split( ':' );
    propValues = propValues.slice( 1 ).join( ':' );

    return propValues;
};

export let updateKanbanCardData = function( data ) {
    let updatedCards = [];
    let updatedObjects = data.eventData.updatedObjects;
    updatedObjects.forEach( function( task ) {
        if( task.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 ) {
            var kanbanTask = constructKanbanBoardObj( task, data );
            updatedCards.push( kanbanTask );
        }
    } );
    updateOperationAtomicData( data.atomicDataRef.kanbanState, 'updateCardProps', updatedCards );
};

export let validateKanbanCardDragDrop = function( kanbanState ) {
    let draggedObj = kanbanState.operation.value;
    let draggedObjectUid = draggedObj.dragContext.source;
    let statusToUpdate = draggedObj.dragContext.to.config.status;
    let dragDropObject = cdm.getObject( draggedObjectUid );
    if( dragDropObject.props.psi0State.dbValues[ 0 ] === 'Complete' && statusToUpdate !== 'Closed' ) {
        let sourceModule = 'PrgScheduleManagerMessages';
        let localTextBundle = localeSvc.getLoadedText( sourceModule );
        let dragObjectErrorMessage = localTextBundle.psi0DragObjectErrorMsg;
        messagingService.showError( dragObjectErrorMessage );
        eventBus.publish( 'Psi0Kanban.dragDropFailure', kanbanState );
    } else {
        eventBus.publish( 'saveEditSOAEvent', kanbanState );
    }
};

export default exports = {
    initializeKanbanColumns,
    createKanbanPropertyString,
    constructKanbanColumns,
    parseKanbanSOAResponse,
    prepareDataForSaveEdit,
    revertPDRKanbanCardDragDrop,
    createInputForLoadEditing,
    extractSrcObjsLSD,
    getSortingOrderFromPreference,
    getDisplayLimitFromPreference,
    updateKanbanCardData,
    validateKanbanCardDragDrop
};
