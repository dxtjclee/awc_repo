// Copyright (c) 2022 Siemens

/**
 * @module js/Ase0FloatingWindowHandler
 */
import AwPromiseService from 'js/awPromiseService';
import vmcs from 'js/viewModelObjectService';
import dmSvc from 'soa/dataManagementService';
import manageDiagramSoaSvc from 'js/Ase0ManageDiagramSoaService';
import { popupService } from 'js/popupService';
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};
var _popupRef;

var _previewDiagramCache = {};

//Load Diagram Select View on clicking diagram link
export let sendViewChangeEvent = function() {
    eventBus.publish( 'awFloatGraphPopup.requestView', { view: 'DiagramSelect' } );
};

export let openDiagramPreview = function( vmo ) {
    if( vmo && vmo.uid && vmo.props ) {
        var showDiagramEventData = {
            diagramVMO: vmo,
            diagramUID: vmo.uid,
            diagramName: vmo.props.object_string.dbValue
        };
        eventBus.publish( 'awFloatGraphPopup.dblClickDiagramInList', showDiagramEventData );
    }
};

export let diagramDoubleClicked = function( data, graphDoubleClickItem ) {
    if( graphDoubleClickItem && graphDoubleClickItem.getItemType() === 'Node' ) {
        if( data.currentObject.props.awb0UnderlyingObject !== graphDoubleClickItem.modelObject.props.awb0UnderlyingObject ) {
            eventBus.publish( 'awFloatGraphPopup.getAssociatedDiagrams', { object: graphDoubleClickItem.modelObject } );
        } else if( data.relatedDiagramList.dbValue.length > 1 ) {
            exports.requestView( data, 'DiagramSelect' );
        }
    }
};

let onSelectCrumb = function( crumb ) {
    eventBus.publish( 'awFloatGraphPopup.getAssociatedDiagrams', {
        object: crumb.data,
        selectedCrumb: crumb
    } );
};

var updateLocation = function( data, eventData ) {
    if( data && data.crumbs ) {
        var newCrumbs = [];
        if( eventData.selectedCrumb ) {
            var selectedCrumb = eventData.selectedCrumb;

            for( var i = 0; i < data.crumbs.length; i++ ) {
                var element = data.crumbs[ i ];

                if( element === selectedCrumb ) {
                    var newCrumbTemp = {
                        clicked: false,
                        displayName: selectedCrumb.displayName,
                        selectedCrumb: true,
                        width: 200,
                        data: selectedCrumb.data,
                        scopedUid: selectedCrumb.data.uid,
                        onCrumbClick: ( crumb ) => onSelectCrumb( crumb )
                    };
                    newCrumbTemp.showArrow = true;
                    newCrumbs.push( newCrumbTemp );
                    break;
                } else {
                    element.showArrow = true;
                    newCrumbs.push( element );
                }
            }

            data.dispatch( { path:'data.crumbs', value:newCrumbs } );
        } else {
            var displayName = '';

            if( eventData.object.props.awb0UnderlyingObject ) {
                displayName = eventData.object.props.awb0UnderlyingObject.uiValues[ '0' ];
            } else if( eventData.object.props.awp0CellProperties ) {
                displayName = eventData.object.props.awp0CellProperties.uiValues[ '0' ];
            }
            var newCrumb = {
                clicked: false,
                displayName: displayName,
                selectedCrumb: true,
                width: 200,
                data: eventData.object,
                scopedUid: eventData.object.uid,
                onCrumbClick: ( crumb ) => onSelectCrumb( crumb )
            };

            if( data.crumbs.length > 0 ) {
                var lastCrumb = _.last( data.crumbs );
                if( lastCrumb && lastCrumb.displayName === displayName ) {
                    return;
                }
            }

            _.forEach( data.crumbs, function( crumb ) {
                crumb.selectedCrumb = false;
                crumb.clicked = false;
                newCrumbs.push( crumb );
            } );
            newCrumb.showArrow = true;
            newCrumbs.push( newCrumb );
            data.dispatch( { path:'data.crumbs', value:newCrumbs } );
            checkBreadcrumbOverflow( data );
        }
    }
};

export let showFloatingWindowPopup = function( popupData ) {
    popupService.show( popupData ).then( function( popupRef ) {
        _popupRef = popupRef;
    } );
};

export let closeFGPopup = function() {
    _.defer( function() {
        _popupRef.options.disableClose = false;
        popupService.hide( _popupRef );
    } );
};

export let getAssociatedDiagramsInput = function( ctx, data, eventData, occContext ) {
    // Check for invalid input.
    if( !ctx || !data || !eventData ) {
        return {};
    }
    var nodeObject;
    if( eventData.object ) {
        nodeObject = eventData.object;
    } else {
        nodeObject = eventData.modelObject;
    }
    // Loading property for future use in breadcrumb
    dmSvc.getProperties( [ nodeObject.uid ], [ 'awb0UnderlyingObject' ] );

    var selection = ctx.mselected[ 0 ];
    selection = nodeObject;
    var startIndex;
    if( data.dataProviders && data.dataProviders.associatedDiagramsList ) {
        startIndex = data.dataProviders.associatedDiagramsList.startIndex;
    } else {
        startIndex = 0;
    }
    return {
        maxToLoad: 50,
        maxToReturn: 50,
        providerName: 'Ase0AssocDiagramProvider',
        searchCriteria: {
            elementUids: selection.uid,
            productContextUids: occContext.productContextInfo.uid
        },
        startIndex: startIndex
    };
};

var clearGraph = function( graphModel ) {
    if( graphModel && graphModel.graphControl ) {
        graphModel.clearGraph();
        graphModel.graphControl.layout = null;
    }
};

export let checkBreadcrumbOverflow = function( data, breadcrumbconfig, provider ) {
    var config = null;
    if( breadcrumbconfig ) {
        config = breadcrumbconfig;
    } else if( data.breadcrumb && data.breadcrumb.config ) {
        config = data.breadcrumb.config;
    }
    // overflow icon shown at the start of crumb i.e first position
    if( config && config.overflowIndex === 0 ) {
        data.overflowAtStart = true;
    }
    var crumbsList = null;
    if( provider && provider.crumbs ) {
        crumbsList = provider.crumbs;
    } else if( data.breadcrumb.config.crumbDataProvider && data.crumbs ) {
        crumbsList = data.crumbs;
    }
    var dataProvider = null;
    if( provider ) {
        dataProvider = provider;
    } else if( data.breadcrumb.config.crumbDataProvider ) {
        dataProvider = data.breadcrumb.config.crumbDataProvider;
    }
    var bcWidth = 0;
    var crumbCount = 0;
    var doubleLeftIconWidth = 24; // default width of overflow icon
    var breadCrumbs = $( 'div.aw-layout-eachCrumb.ng-scope' );
    breadCrumbs.each( function() {
        if( crumbsList[ crumbCount ] && ( !crumbsList[ crumbCount ].width || $( 'div.aw-layout-eachCrumb.ng-scope' ).width() > 0 ) ) {
            crumbsList[ crumbCount ].width = $( 'div.aw-layout-eachCrumb.ng-scope' ).width();
        }
        crumbCount++;
    } );
    crumbsList.forEach( function( element ) {
        bcWidth += element.width;
    } );
    var parentElements = $( 'aw-navigate-breadcrumb.ng-isolate-scope' ).parent();
    var workareaWidth = $( parentElements[ 1 ] ).width();
    if( workareaWidth < bcWidth ) {
        //if the overflow icon position is zero(i.e. at the start of crumbs) then overflow icon will take extra width.
        if( config && config.overflowIndex === 0 ) {
            workareaWidth -= doubleLeftIconWidth;
        }
        var crumbPopList = [];
        if( config && config.overflowIndex ) {
            for( var i = 0; i < crumbsList.length; i++ ) {
                if( i === config.overflowIndex - 1 ) {
                    crumbsList[ i ].overflowIconPosition = true;
                } else {
                    crumbsList[ i ].overflowIconPosition = false;
                }
            }
            // recalculating the available width & breadcrumbWidth if overflow index is not at the start of breadcrumb
            for( var i = 0; i < config.overflowIndex; i++ ) {
                workareaWidth -= crumbsList[ i ].width;
                bcWidth -= crumbsList[ i ].width;
            }
            for( var i = config.overflowIndex; i < crumbsList.length; i++ ) {
                if( bcWidth > workareaWidth ) {
                    bcWidth -= crumbsList[ i ].width;
                    crumbPopList.push( crumbsList[ i ] );
                    crumbsList[ i ].willOverflow = true;
                } else {
                    crumbsList[ i ].willOverflow = false;
                }
            }
        }
        dataProvider.overflowCrumbList = crumbPopList;
        if( dataProvider.overflowCrumbList.length ) {
            data.showOverflowAtStart = true;
        }
    } else if( config && config.overflowIndex ) {
        // no overflow : form linear crumbs
        data.showOverflowAtStart = false;
        if( !_.isEmpty( crumbsList ) ) {
            if( !_.isEmpty( dataProvider.overflowCrumbList ) ) {
                for( var i = 0; i < dataProvider.overflowCrumbList.length; i++ ) {
                    var crumbNdx = i + config.overflowIndex;
                    if( crumbsList[ crumbNdx ] ) {
                        crumbsList[ crumbNdx ].willOverflow = false;
                    }
                }
                dataProvider.overflowCrumbList = [];
            }
            // overflow index is not at the start of crumbs
            if( config.overflowIndex &&
                crumbsList.length >= config.overflowIndex ) {
                crumbsList[ config.overflowIndex - 1 ].overflowIconPosition = false;
            }
        }
    }
};

/**
 * create input for manageDiagram2 SOA
 */
export let getManageDiagram2Input = function( data, manageDiagramQueue, eventData, activeLegendView, subPanelContext ) {
    let occContext = subPanelContext.context.occContext;
    if( !data || !manageDiagramQueue || !eventData || !eventData.diagramUID ) {
        return [];
    }

    _.set( eventData, 'userAction', 'OpenFloatDiagram' );
    var input = manageDiagramSoaSvc.getManageDiagram2Input( eventData, manageDiagramQueue, data.graphModel, occContext, activeLegendView );

    input[ 0 ].primaryObjects = [ {
        type: 'Ase0Diagram',
        uid: eventData.diagramUID
    } ];

    if( data.archGraphModel && data.archGraphModel.isGraphFitted ) {
        data.archGraphModel.isGraphFitted = false;
    }

    if( data.graphModel ) {
        clearGraph( data.graphModel );
    }

    return input;
};
/*
 * method to get manageDiagram2 SOA response and pass it to FGManageDiagramComplete event for further processing.
 */
export let getManageDiagram2Response = function( response ) {
    var graphData = _.clone( response );
    var eventData = {
        graphData: graphData
    };
    eventBus.publish( 'FGManageDiagramComplete', eventData );
    return graphData;
};
/**
 * Switches the active view within the popup window.
 *
 * @param {DeclViewModel} data - Model that owns the action.
 * @param {String} view - Name of the view to show.
 *
 * @returns {Promise} A promise that calls {@link deferred~resolve} once the
 *     desired view loaded successfully, {@link deferred~reject} otherwise.
 */
export let requestView = function( data, view ) {
    var activeView = _.clone( data.activeView );
    if( data.activeView !== view ) {
        activeView = view;
    }
    return activeView;
};

export let dblClickDiagramInList = function( data ) {
    exports.showDiagramAndCache( data.currentObject, data.eventData );
};

export let previewDiagram = function( data ) {
    var selectedObjects = data.dataProviders.associatedDiagramsList.getSelectedObjects();

    if( selectedObjects.length > 0 ) {
        var diagram = selectedObjects[ '0' ];

        var showDiagramEventData = {
            diagramVMO: diagram,
            diagramUID: diagram.uid,
            diagramName: diagram.props.object_string.dbValue
        };

        exports.showDiagramAndCache( data.currentObject, showDiagramEventData );
    }
};

export let showDiagramAndCache = function( currentObject, showDiagramEventData ) {
    _previewDiagramCache[ currentObject ] = showDiagramEventData;

    eventBus.publish( 'awFloatGraphPopup.showDiagram', showDiagramEventData );
};

export let setAsDefaultDiagram = function( data, cellState ) {
    var newState = { ...cellState.value };
    // Make sure the object is modifiable.
    if( data.currentObject.props.is_modifiable.dbValues[ '0' ] === '0' ) {
        return AwPromiseService.instance.reject();
    }

    var selectedObjects = data.dataProviders.associatedDiagramsList.getSelectedObjects();

    // Nothing selected or too many selected or already the default diagram
    if( !selectedObjects || selectedObjects.length === 0 || selectedObjects.length > 1 || selectedObjects[ 0 ].ase0IsDefaultDiagram ) {
        return AwPromiseService.instance.reject();
    }

    var currentDefault;
    var deferred = AwPromiseService.instance.defer();

    // Get all of the loaded Diagram VMOs.
    var diagramVMOs = data.dataProviders.associatedDiagramsList.viewModelCollection.getLoadedViewModelObjects();

    // Clear the is default diagram checkmark from all diagrams.
    _.forEach( diagramVMOs, function( diagramVMO ) {
        if( diagramVMO.ase0IsDefaultDiagram ) {
            currentDefault = diagramVMO;
        }
        diagramVMO.ase0IsDefaultDiagram = false;
    } );

    // Add the checkmark to the selected object.
    selectedObjects[ 0 ].ase0IsDefaultDiagram = true;

    //Adding this flag to update and render Cell view after check mark is added
    newState.ase0IsDefaultDiagram = true;
    cellState.update( newState );

    // When the default is set, it should be the cached diagram
    var showDiagramEventData = {
        diagramVMO: selectedObjects[ 0 ],
        diagramUID: selectedObjects[ 0 ].uid,
        diagramName: selectedObjects[ 0 ].props.object_string.dbValue
    };
    _previewDiagramCache[ data.currentObject ] = showDiagramEventData;

    // Kick off a background SOA call to
    // update the default diagram.
    dmSvc.setProperties(
        [ {
            object: {
                uid: selectedObjects[ 0 ].relUID,
                type: 'Ase0DiagramRelation'
            },
            vecNameVal: [ {
                name: 'ase0IsDefaultDiagram',
                values: [
                    'true'
                ]
            } ]
        } ] ).then( deferred.resolve(), function setDefaultDiagramFailure( SoaResponse ) {
        // Return the list to before the call.
        if( currentDefault ) {
            currentDefault.ase0IsDefaultDiagram = true;
        }

        selectedObjects[ 0 ].ase0IsDefaultDiagram = false;

        deferred.reject( SoaResponse );
    } );


    return deferred.promise;
};

export let refitGraph = function( params ) {
    setTimeout( function() {
        params.graphControl.fitGraph();
    } );
};

/**
 * Processes the getAssociatedDiagrams SOA response data and
 * stores the results in the data.
 *
 * This is intentionally left as a promise so we can specify
 * conditional events in the JSON.
 *
 * @param {DeclViewModel} data - Model that owns the action.
 *
 * @returns {Promise} A promise that calls {@link deferred~resolve} once the
 *     desired view loaded successfully, {@link deferred~reject} otherwise.
 */
export let processGetAssociatedDiagramsResponse = function( data, context ) {
    var rData = [];
    var response;
    if( data.searchResults && data.searchResultObjects ) {
        response = data;
    } else {
        response = context;
    }

    _.forEach( response.searchResults.objects, function( diagramProxyObj ) {
        var diagramProxyObject = vmcs.createViewModelObject( diagramProxyObj.uid, 'EDIT' );

        if( diagramProxyObject.props && diagramProxyObject.props.ase0EndObject &&
            diagramProxyObject.props.ase0EndObject.dbValues ) {
            var diagramModelObject = vmcs.createViewModelObject(
                diagramProxyObject.props.ase0EndObject.dbValue, 'EDIT' );

            if( diagramModelObject && cmm.isInstanceOf( 'Ase0Diagram', diagramModelObject.modelType ) &&
                diagramProxyObject.props.ase0Relation &&
                diagramProxyObject.props.ase0Relation.dbValues &&
                diagramProxyObject.props.ase0Relation.dbValues[ 0 ] ) {
                // Store the Diagram Relation's UID.
                diagramModelObject.relUID = diagramProxyObject.props.ase0Relation.dbValues[ 0 ];

                var diagramRelationObj = response.searchResultObjects[ diagramModelObject.relUID ];

                // Check if it's the default diagram.
                if( diagramRelationObj && diagramRelationObj.props && diagramRelationObj.props.ase0IsDefaultDiagram &&
                    diagramRelationObj.props.ase0IsDefaultDiagram.dbValues[ '0' ] === '1' ) {
                    // Update the view model object.
                    diagramModelObject.ase0IsDefaultDiagram = true;
                } else {
                    // Update the view model object.
                    diagramModelObject.ase0IsDefaultDiagram = false;
                }
                rData.push( diagramModelObject );
            }
        }
    } );

    // Set the data and resolve.
    data.relatedDiagramList.dbValue = rData;
    data.relatedDiagramFilterList.dbValue = data.relatedDiagramList.dbValue;

    // Return a resolved promise.
    return AwPromiseService.instance.resolve();
};

var checkDiagramToLoad = function( data, modelObject ) {
    // Check if one of the diagrams was previewed.
    var diagramToLoad = _previewDiagramCache[ modelObject ];

    // Check the diagrams list.
    if( !diagramToLoad && data.relatedDiagramList.dbValue.length > 0 ) {
        var defaultDiagramVMO = null;

        // If there's only one, show it.
        if( data.relatedDiagramList.dbValue.length === 1 ) {
            defaultDiagramVMO = data.relatedDiagramList.dbValue[ 0 ];

            // Check if there is a default diagram.
        } else {
            defaultDiagramVMO = _.find( data.relatedDiagramList.dbValue, { ase0IsDefaultDiagram: true } );
        }

        // Format the result as expected.
        if( defaultDiagramVMO ) {
            diagramToLoad = {
                diagramVMO: defaultDiagramVMO,
                diagramUID: defaultDiagramVMO.uid,
                diagramName: defaultDiagramVMO.props.object_string.dbValue
            };
        }
    }

    return diagramToLoad;
};

export let onDiagramLoadComplete = function( data, eventData ) {
    var currentDiagram = _.clone( data.currentDiagram );
    currentDiagram = eventData.diagramVMO;

    return currentDiagram;
};

export let onGetAssociatedDiagramsComplete = function( data, context, eventDataPopup ) {
    if( !data || !context || !eventDataPopup ) {
        // Throw err.
    }

    if( data.relatedDiagramList && data.relatedDiagramList.dbValue && data.relatedDiagramList.dbValue.length > 0 ) {
        data.currentDiagram = null;
        var evntData = null;
        let diagramToLoad;
        if( eventDataPopup && eventDataPopup.object ) {
            evntData = eventDataPopup;
        } else if( context.object ) {
            evntData = context;
        }
        if( evntData ) {
            data.dispatch( { path:'data.currentObject', value:evntData.object } );
            updateLocation( data, evntData );
            diagramToLoad = checkDiagramToLoad( data, evntData.object );
        }


        if( diagramToLoad ) {
            eventBus.publish( 'awFloatGraphPopup.showDiagram', diagramToLoad );
        } else {
            eventBus.publish( 'awFloatGraphPopup.requestView', { view: 'DiagramSelect' } );
        }
    }
};

/**
 * Ase0FloatingWindowHandler factory
 */

// Angular JS.

// DeclViewModel loaders.

// View Model Service.

// Data Management Service.

// Command Panel Service.

export default exports = {
    openDiagramPreview,
    diagramDoubleClicked,
    getAssociatedDiagramsInput,
    getManageDiagram2Input,
    getManageDiagram2Response,
    requestView,
    dblClickDiagramInList,
    previewDiagram,
    showDiagramAndCache,
    setAsDefaultDiagram,
    refitGraph,
    processGetAssociatedDiagramsResponse,
    onDiagramLoadComplete,
    onGetAssociatedDiagramsComplete,
    closeFGPopup,
    showFloatingWindowPopup,
    checkBreadcrumbOverflow,
    sendViewChangeEvent
};
