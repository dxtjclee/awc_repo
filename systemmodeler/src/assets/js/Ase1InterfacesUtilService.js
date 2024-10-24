//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interface Page service
 *
 * @module js/Ase1InterfacesUtilService
 */

import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import columnArrangeService from 'js/columnArrangeService';

const systemContainsIn = function( modelObject, systems ) {
    var isValidSystem = false;
    if( !modelObject || !systems || systems.length === 0 ) { return false; }

    var matchSystem = _.find( systems, function( system ) {
        return system.nodeObject.uid === modelObject.uid;
    } );
    if( matchSystem ) {
        isValidSystem = true;
    }
    return isValidSystem;
};

const getSystemType = function( modelObject, modelData ) {
    if( !modelObject ) {
        return undefined;
    }
    if( modelObject.uid === modelData.systemOfInterest.nodeObject.uid ) {
        return 'SystemOfInterest';
    }
    if( modelData.systemInView && modelObject.uid === modelData.systemInView.nodeObject.uid ) {
        return 'SystemInView';
    }
    if( modelData.internalSystems && modelData.internalSystems.length > 0 && systemContainsIn( modelObject, modelData.internalSystems ) ) {
        return 'InternalSystem';
    }
    if( modelData.externalSystems && modelData.externalSystems.length > 0 && systemContainsIn( modelObject, modelData.externalSystems ) ) {
        return 'ExternalSystem';
    }
    return 'BundledConnection';
};

export let getColumnConfigBasedOnSelection = function( input ) {
    // By default, interface table is primary table
    var columnURI = 'Ase1InterfaceTableUIConfig';
    if( input.selected.modelType.typeHierarchyArray.indexOf( 'FunctionalityRevision' ) > -1 || input.selected.modelType.typeHierarchyArray.indexOf( 'Ase0FunctionalElement' ) > -1 ) {
        columnURI = 'Ase1FunctionPortsTableUIConfig';
    }
    return columnURI;
};

export let getDataProviderBasedOnSelection = function( input ) {
    var dataProvider = 'Ase1InterfaceTableProvider';
    if( input.selected.modelType.typeHierarchyArray.indexOf( 'FunctionalityRevision' ) > -1 || input.selected.modelType.typeHierarchyArray.indexOf( 'Ase0FunctionalElement' ) > -1 ) {
        dataProvider = 'Ase1PortTableProvider';
    }
    return dataProvider;
};

export let getSelectedElementUids = function( input ) {
    var selectedUid = input.selected.uid;
    if( input.selected.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) > -1 ) {
        selectedUid = input.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
    }
    return selectedUid;
};

export let updateTableForPrimarySelection = function( input, data ) {
    let tabsInContextNew = data.tabsInContext;
    let functionExchangeSelected = false;
    if( input && input.modelType.typeHierarchyArray.indexOf( 'Awb0Connection' ) > -1 ) {
        let selectedUid = input.uid;
        selectedUid = input.props.awb0UnderlyingObject.dbValues[ 0 ];
        if( selectedUid ) {
            var selectedObject = cdm.getObject( selectedUid );
            if( selectedObject && selectedObject.modelType && cmm.isInstanceOf( 'Sys0FunctionExchRevision', selectedObject.modelType ) ) {
                functionExchangeSelected = true;
            }
        }
    }
    if( tabsInContextNew ) {
        tabsInContextNew.forEach( element => {
            if( element?.displayTab === false ) {
                element.selectedTab = false;
            }
        } );
        data.dispatch( { path: 'data.tabsInContext', value: tabsInContextNew } );
    }

    return functionExchangeSelected;
};

export let getInterfaceTableSelectedUid = function( input ) {
    let interfaceTableSelectedUid;
    if( input && input.length > 0 ) {
        if( input[ 0 ].modelType.typeHierarchyArray.indexOf( 'Ase1InterfaceTableProxy' ) > -1 ) {
            interfaceTableSelectedUid = input[ 0 ].props.ase1InterfaceObject.dbValues[ 0 ];
        } else {
            interfaceTableSelectedUid = '';
        }
    }
    return interfaceTableSelectedUid;
};

export let getExchItemsTableSelectedUid = function( input ) {
    let exchItemsTableSelectedUid;
    if( input && input.length > 0 ) {
        if( input[ 0 ].modelType.typeHierarchyArray.indexOf( 'Network_Port' ) > -1 ) {
            exchItemsTableSelectedUid = input[ 0 ].uid;
        } else {
            exchItemsTableSelectedUid = '';
        }
    }
    return exchItemsTableSelectedUid;
};

/**
 * Process selection change in Graph or Grid view
 * @param {Object} primarySelectionData Selection from graph/grid view
 * @param {Object} secondarySelectionData Selection from connection table
 * @param {Object} selectionData Selection Data from parent component
 */

export let processSelectionChange = function( primarySelectionData, secondarySelectionData, selectionData ) {
    if( _.isEmpty( primarySelectionData ) && _.isEmpty( secondarySelectionData ) ) {
        return;
    }

    let selectionToUpdate = {};
    if( secondarySelectionData.selected && !_.isEmpty( secondarySelectionData.selected ) ) {
        selectionToUpdate = secondarySelectionData;
    } else if( primarySelectionData.selected && !_.isEmpty( primarySelectionData.selected ) ) {
        selectionToUpdate = primarySelectionData;
    } else {
        selectionToUpdate = { ...selectionData };
        selectionToUpdate.selected = [];
    }
    // pass selection to parent component
    selectionData.update( selectionToUpdate );
};

/**
 * Populate message to be displayed in Show Details panel when there is no selection in Interfaces primary tables
 * @param {Object} selected selected object
 * @param {Object} data data
 * @returns {Object} message to be displayed for empty selection
 */
export let populateSelectMessage = function( selected, data ) {
    let message = '';
    if( selected && selected.modelType ) {
        if( cmm.isInstanceOf( 'Awb0Element', selected.modelType ) ) {
            message = data.i18n.connectionSelectMessage;
        } else if( cmm.isInstanceOf( 'FunctionalityRevision', selected.modelType ) ) {
            message = data.i18n.functionSelectMessage;
        } else {
            message = data.i18n.interfaceSelectMessage;
        }
    }
    return message;
};

export let getColumnConfigForConnections = function( input ) {
    var columnURI = 'Ase1UnbundledConnectionsTableDCP';
    if( input.selected.modelType.typeHierarchyArray.indexOf( 'Ase0FunctionalElement' ) > -1 ) {
        columnURI = 'Ase1FunctionConnectionsTableDCP';
    }
    return columnURI;
};

export let loadConnectionData = function( serviceName, operationName, body, propertyPolicyOverride ) {
    return soaSvc.postUnchecked( serviceName, operationName, body, propertyPolicyOverride );
};

export const arrangeColumns = function( data, eventData, props ) {
    const updatedEventData = {
        props: props,
        ...eventData
    };

    return columnArrangeService.arrangeColumns( data, updatedEventData );
};

const exports = {
    getSystemType,
    getColumnConfigBasedOnSelection,
    getDataProviderBasedOnSelection,
    getInterfaceTableSelectedUid,
    getExchItemsTableSelectedUid,
    getSelectedElementUids,
    updateTableForPrimarySelection,
    processSelectionChange,
    populateSelectMessage,
    getColumnConfigForConnections,
    loadConnectionData,
    arrangeColumns
};
export default exports;
