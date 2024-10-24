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
 * @module js/Ase1InterfacesPageService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import interfacesUtilService from 'js/Ase1InterfacesUtilService';

var _interfacesUnloadedEventListener = null;

var _productContextChanged = null;

const _interfacesPageSessionData = {
    viewName: 'Ase1InterfacesGraph',
    selectedSplitPanelLocation: 'bottom'
};

/**
 * Register context on Interfaces tab load.
 * @param {Object} interfacePageState Page State
 * @returns {Object} updates Page State
 */
export let handleInterfacesPageLoad = function( interfacePageState ) {
    let newInterfacePageState = { ...interfacePageState };
    var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( interfacesCtx ) {
        interfacesCtx.isInterfacesActive = true;
        interfacesCtx.internalSystemsExists = false;
        interfacesCtx.nodeMap = {};
        interfacesCtx.edgeMap = {};
        interfacesCtx.selectedNodes = [];
        appCtxSvc.updateCtx( 'interfacesCtx', interfacesCtx );
    } else {
        interfacesCtx = {
            isInterfacesActive: true,
            internalSystemsExists: false,
            nodeMap: {},
            edgeMap: {},
            selectedNodes: []
        };
        appCtxSvc.registerCtx( 'interfacesCtx', interfacesCtx );
    }

    var interfacesViewModeCtx = appCtxSvc.getCtx( 'interfacesViewModeCtx' );
    if( !interfacesViewModeCtx ) {
        interfacesViewModeCtx = {
            viewMode: 'Ase1GraphView',
            selectedSplitPanelLocation: 'bottom'
        };
        appCtxSvc.registerCtx( 'interfacesViewModeCtx', interfacesViewModeCtx );
    }

    newInterfacePageState = Object.assign( newInterfacePageState, _interfacesPageSessionData );

    var interfacesLabelCtx = appCtxSvc.getCtx( 'interfacesLabelCtx' );
    if( !interfacesLabelCtx ) {
        interfacesLabelCtx = {
            LabelProperties: {}
        };
        appCtxSvc.registerCtx( 'interfacesLabelCtx', interfacesLabelCtx );
    }

    if( !_interfacesUnloadedEventListener ) {
        _interfacesUnloadedEventListener = eventBus.subscribe( 'Ase1InterfacesPage.contentUnloaded', function() {
            handleInterfacesUnloaded();
        }, 'Ase1InterfacesPageService' );
    }

    return {
        pageState: newInterfacePageState,
        actionState: {
            getInterfaces: {
                navigationMode: 'ShowInterfaces'
            }
        }
    };
};

/**
 * Unregister context on Interfaces tab load.
 */
function handleInterfacesUnloaded() {
    eventBus.unsubscribe( _interfacesUnloadedEventListener );
    _interfacesUnloadedEventListener = null;
    appCtxSvc.unRegisterCtx( 'interfacesCtx' );
}

/**
 * Getting external systems
 * @param {Object} externalSystems - external systems
 *
 * @return {Object} external system objects
 */
function getExternalSystemObjects( externalSystems ) {
    return _.map( externalSystems, 'nodeObject' );
}

/**
 * Create input for getInterfaces SOA
 * @param {Object} eventData event data
 * @param {Object} systemOfInterestModelObj System of Interest Model Object
 * @param {Object} productContextInfo ACE Product Context
 * @param {Object} interfacesCtx Model Data
 * @return {Array} input data for get interfaces
 */
export let getInterfacesInput = function( eventData, systemOfInterestModelObj, productContextInfo, interfacesCtx ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    // if( !interfacesCtx ) {
    //     return null;
    // }
    var input = [];
    var curDate = new Date();
    var clientId = eventData.navigationMode + curDate.getTime();
    var externalSystems = null;
    var systemInView = null;
    var isSystemOfViewExpanded = 'false';
    var sortBy = [];

    switch ( eventData.navigationMode ) {
        case 'ShowInterfaces':
            systemInView = systemOfInterestModelObj;
            externalSystems = [];
            break;
        case 'ShowChildInterfaces':
        case 'ShowParentInterfaces':
            externalSystems = getExternalSystemObjects( interfacesCtx.externalSystems );
            systemInView = eventData.systemInView;
            break;
        case 'UpdateLabelProperties':
            externalSystems = getExternalSystemObjects( interfacesCtx.externalSystems );
            systemInView = interfacesCtx.systemInView.nodeObject;
            if( interfacesCtx.internalSystemsExists ) {
                isSystemOfViewExpanded = 'true';
            }
            sortBy.push( eventData.sortByLabel );
            break;
        default:
            break;
    }

    var inputData = {
        clientId: clientId,
        systemOfInterest: systemOfInterestModelObj,
        systemInView: systemInView,
        externalSystems: externalSystems,
        navigationMode: eventData.navigationMode,
        diagramInfo: {
            sortBy: sortBy,
            isSystemOfViewExpanded: [ isSystemOfViewExpanded ]
        },
        inputContext: {
            productContext: productContextInfo
        }
    };

    input.push( inputData );
    return input;
};

var createNode = function( nodeObject, nodeLabel, numChildren, isExternal ) {
    return {
        nodeObject: nodeObject,
        nodeLabel: nodeLabel,
        isExternal: isExternal,
        numChildren: numChildren
    };
};

var processResponseToGetNodes = function( interfacesCtx, systems, isExternal ) {
    var nodes = [];
    _.forEach( systems, function( system ) {
        var nodeObject = system.node;
        if( !nodeObject ) {
            nodeObject = cdm.getObject( system.node.uid );
        }
        if( nodeObject ) {
            var nodeLabel = system.nodeInfo.displayProperties[ 0 ];
            let numChildren = _.get( system.nodeInfo, 'numChildren[0]', 0 );
            numChildren = _.parseInt( numChildren );
            var node = createNode( nodeObject, nodeLabel, numChildren, isExternal );
            nodes.push( node );
            interfacesCtx.nodeMap[ nodeObject.uid ] = node;
        }
    } );

    return nodes;
};

var createEdge = function( edgeObject, end1Element, end2Element ) {
    return {
        edgeObject: edgeObject,
        end1Element: end1Element,
        end2Element: end2Element
    };
};

var processResponseToGetEdges = function( edgesData ) {
    var edges = [];
    _.forEach( edgesData, function( edgeData ) {
        var edge = createEdge( edgeData.edge, edgeData.end1Element, edgeData.end2Element );
        edges.push( edge );
    } );

    return edges;
};

var updateModel = function( interfacesCtx, systemInView, internalNodes, externalNodes, edges ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    interfacesCtx.systemInView = systemInView;
    interfacesCtx.internalSystems = internalNodes;

    if( !internalNodes || internalNodes.length === 0 ) {
        interfacesCtx.externalSystems = externalNodes;
        interfacesCtx.internalSystemsExists = false;
    } else {
        interfacesCtx.internalSystemsExists = true;
    }

    interfacesCtx.visibleExternalSystems = externalNodes;
    interfacesCtx.edges = edges;
};

const populateLabelInfo = function( pageStateValue, diagramInfo ) {
    if( !diagramInfo ) {
        return;
    }
    const labelPropMap = {};
    _.map( diagramInfo, function( value, key ) {
        if( key !== 'hasSystemModelerLicense' ) {
            labelPropMap[ key ] = value[ 0 ];
        }
    } );
    pageStateValue.LabelProperties = labelPropMap;

    if( !pageStateValue.selectedLabelProperty ) {
        const labelName = appCtxSvc.getCtx( 'preferences.ASE1_Interfaces_Node_Label_Property[0]' );
        pageStateValue.selectedLabelProperty = {
            name: labelName,
            dispName: _.get( pageStateValue.LabelProperties, labelName, labelName )
        };
    }
};

export const getInterfacesOutput = function( soaResponse, systemOfInterestModelObj, pageState ) {
    const pageStateValue = { ...pageState };
    if( !pageStateValue.modelData ) {
        const systemOfInterest = createNode( systemOfInterestModelObj, '', 0, false );
        pageStateValue.modelData = {
            systemOfInterest: systemOfInterest
        };
    }

    const output = _.get( soaResponse, 'results[0]' );
    if( output ) {
        if( output.externalNodeData.length === 0 && output.internalNodeData.length === 0 && output.edgeData.length === 0 && output.navigationMode === 'ShowChildInterfaces' ) {
            // if no internal nodes found on double click then remove moved system in view from breadcrumb
            if( pageStateValue.breadCrumb && pageStateValue.breadCrumb.length > 0 ) {
                let lastIndex = pageStateValue.breadCrumb.length - 1;
                if( pageStateValue.modelData.systemInView.nodeObject.uid === pageStateValue.breadCrumb[lastIndex].uid ) {
                    pageStateValue.breadCrumb.pop();
                }
            }
            return pageStateValue;
        }

        pageStateValue.modelData.nodeMap = {};

        var externalSystems = output.externalNodeData;
        var internalSystems = output.internalNodeData;
        var edgeData = output.edgeData;

        if( output.diagramInfo && output.diagramInfo.hasSystemModelerLicense && output.diagramInfo.hasSystemModelerLicense.length > 0 ) {
            var hasSystemModelerLicense =  output.diagramInfo.hasSystemModelerLicense[ 0 ] === 'true';

            pageStateValue.modelData.hasSystemModelerLicense = hasSystemModelerLicense;
        }
        const numChildren = _.parseInt( output.systemInView.nodeInfo.numChildren[ 0 ] );
        const systemInView = createNode( output.systemInView.node, output.systemInView.nodeInfo.displayProperties[ 0 ], numChildren, false );
        pageStateValue.modelData.nodeMap[ systemInView.nodeObject.uid ] = systemInView;

        // Update label property for system of interest
        if( pageStateValue.modelData.systemOfInterest.nodeObject.uid === systemInView.nodeObject.uid ) {
            pageStateValue.modelData.systemOfInterest.nodeLabel = systemInView.nodeLabel;
            pageStateValue.modelData.systemOfInterest.numChildren = systemInView.numChildren;
        } else {
            pageStateValue.modelData.nodeMap[ pageStateValue.modelData.systemOfInterest.nodeObject.uid ] = pageStateValue.modelData.systemOfInterest;
        }

        var externalNodes = processResponseToGetNodes( pageStateValue.modelData, externalSystems, true );
        var internalNodes = processResponseToGetNodes( pageStateValue.modelData, internalSystems, false );
        var edges = processResponseToGetEdges( edgeData );
        populateLabelInfo( pageStateValue, output.diagramInfo );

        updateModel( pageStateValue.modelData, systemInView, internalNodes, externalNodes, edges );
    }

    return pageStateValue;
};

var fireAceSelectionEvent = function( doubleClickedObject ) {
    if( !doubleClickedObject ) {
        return;
    }

    // check if awb0Parent property is loaded before firing ACE selection change event
    var parentObject = doubleClickedObject.props.awb0Parent;
    if( parentObject ) {
        eventBus.publish( 'aceElementsSelectedEvent', {
            elementsToSelect: [ doubleClickedObject ]
        } );
    } else {
        dms.getProperties( [ doubleClickedObject.uid ], [ 'awb0Parent' ] )
            .then(
                function() {
                    eventBus.publish( 'aceElementsSelectedEvent', {
                        elementsToSelect: [ doubleClickedObject ]
                    } );
                } );
    }
};

/**
 * Process double click on Interfaces tab.
 * @param {Object} interfacePageState page state
 * @returns {Object} new page state
 */
export let processObjectDoubleClick = function( interfacePageState ) {
    const interfacePageStateValue = { ...interfacePageState };
    const { doubleClickedObject, modelData } = interfacePageStateValue;
    let actionStateValue = {};
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( doubleClickedObject && modelData && modelData.hasSystemModelerLicense ) {
        // Checking if its system of interest or internal system
        var systemType = interfacesUtilService.getSystemType( doubleClickedObject, modelData );
        if( !systemType ) {
            return;
        }
        if( systemType === 'SystemOfInterest' || systemType === 'InternalSystem' ) {
            actionStateValue = {
                getInterfaces: {
                    navigationMode: 'ShowChildInterfaces',
                    systemInView: doubleClickedObject
                }
            };
            if( systemType === 'InternalSystem' ) {
                if( !interfacePageStateValue.breadCrumb ) {
                    interfacePageStateValue.breadCrumb = [];
                }
                interfacePageStateValue.breadCrumb.push( interfacePageStateValue.modelData.systemInView.nodeObject );
            }
        } else if( systemType === 'ExternalSystem' ) {
            // Fire ACE selection change event
            fireAceSelectionEvent( doubleClickedObject );
        }
        // Reset the selectedNodes
        modelData.selectedNodes = [];
        modelData.isValidIntfSelection = false;
        appCtxSvc.updateCtx( 'interfacesCtx', modelData );
    }

    delete interfacePageStateValue.doubleClickedObject;

    return {
        pageState: interfacePageStateValue,
        actionState: actionStateValue
    };
};

/**
 * Process Go Up command click
 * @param {Object} modelData model data
 * @param {Object} interfacePageState page state
 * @returns {Object} action state value
 */
export let processGoUpCommandClick = function( modelData, interfacePageState ) {
    const interfacePageStateValue = { ...interfacePageState };
    let actionStateValue = {};
    if( modelData && modelData.hasSystemModelerLicense ) {
        let systemInView = interfacePageStateValue.breadCrumb && interfacePageStateValue.breadCrumb.length > 0 ? interfacePageStateValue.breadCrumb.pop() : undefined;
        let eventData = {
            navigationMode: 'ShowInterfaces'
        };

        if( systemInView ) {
            eventData = {
                navigationMode: 'ShowChildInterfaces',
                systemInView: systemInView
            };
        }

        modelData.isValidIntfSelection = false;
        appCtxSvc.updateCtx( 'interfacesCtx', modelData );
        actionStateValue.getInterfaces = eventData;
    }

    return {
        pageState: interfacePageStateValue,
        actionState: actionStateValue
    };
};

/**
 * Process selection change in Graph or Grid view
 * @param {Object} primarySelectionData Selection from graph/grid view
 * @param {Object} secondarySelectionData Selection from connection table
 * @param {Object} selectionData Selection Data from parent component
 */
export let processSelectionChange = function( primarySelectionData, secondarySelectionData, selectionData ) {
    if( _.isEmpty( primarySelectionData ) ) {
        return;
    }

    let selectionToUpdate = secondarySelectionData.selected && secondarySelectionData.selected.length > 0 ? secondarySelectionData : primarySelectionData;

    // pass selection to parent component
    selectionData.update( selectionToUpdate );
};

/**
 * Process the Focus On System Command click
 * @param {Object} systemOfInterest system of interest model object
 * @param {Object} primarySelectionData selection from graph/grid
 * @param {Object} modelData model data
 * @returns {Object} action state
 */
export let processFocusOnSystemCommandClick = function( systemOfInterest, primarySelectionData, modelData ) {
    if( modelData.hasSystemModelerLicense && primarySelectionData.selected && primarySelectionData.selected.length > 0 ) {
        const noOfItems = primarySelectionData.selected.length;
        const selectedNodeObject = primarySelectionData.selected[ noOfItems - 1 ];
        if( selectedNodeObject.uid !== systemOfInterest.uid ) {
            fireAceSelectionEvent( selectedNodeObject );
        }
    }

    return {}; // return empty object to reset action state
};

/**
 * Function to subscribe to product context change event on configuration changed
 * @param {Object} value value object
 */
export let configurationChanged = function( value ) {
    // if startFreshNavigation flag is true then don't need to process further as there will be selection event from ACE
    // and Interfaces tab will react to it
    if( value && Object.keys( value.aceActiveContext.context.configContext ).length > 0
    && !value.aceActiveContext.context.configContext.startFreshNavigation ) {
        if( !_productContextChanged ) {
            _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function() {
                productContextChanged();
            } );
        }
    }
};

/**
 * Function to subscribe to product context change event on reset command execution
 */
export let resetContent = function() {
    if( !_productContextChanged ) {
        _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function() {
            productContextChanged();
        } );
    }
};

/**
 * execute handleInterfacesPageLoad on product context change event
 */
var productContextChanged = function() {
    eventBus.unsubscribe( _productContextChanged );
    _productContextChanged = null;
    eventBus.publish( 'Ase1InterfacesPage.contentLoaded' );
};


const applyLabel = function( labelToApply ) {
    return {
        selectedLabelProperty: labelToApply,
        actionState: {
            getInterfaces: {
                navigationMode: 'UpdateLabelProperties',
                sortByLabel: labelToApply.name
            }
        }
    };
};

/**
 * Process the update Interfaces Page State on cmd click
 * @param {Object} interfacesPageState State of interfaces Page
 * @param {Object} newValue new value of state to change the view
 * @param {Object} primarySelectionState to reset selection data to hide connection table on view change
 *
 */
export const updateInterfacesPageState = function( interfacesPageState, newValue, primarySelectionState ) {
    const interfacesPageStateValue = { ...interfacesPageState.value };
    Object.assign( interfacesPageStateValue, newValue );
    for ( let key in _interfacesPageSessionData ) {
        _interfacesPageSessionData[key] = interfacesPageStateValue[key];
    }
    interfacesPageState.update( interfacesPageStateValue );
    if( primarySelectionState ) {
        const primarySelectionStateValue = { ...primarySelectionState.value };
        primarySelectionStateValue.selected = [];
        primarySelectionState.update( primarySelectionStateValue );
    }
};

const exports = {
    handleInterfacesPageLoad,
    getInterfacesInput,
    getInterfacesOutput,
    processObjectDoubleClick,
    processGoUpCommandClick,
    processSelectionChange,
    processFocusOnSystemCommandClick,
    configurationChanged,
    resetContent,
    applyLabel,
    updateInterfacesPageState
};
export default exports;
