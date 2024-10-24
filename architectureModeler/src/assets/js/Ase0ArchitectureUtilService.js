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
 *
 *
 * @module js/Ase0ArchitectureUtilService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import commandPanelService from 'js/commandPanel.service';
import AwPromiseService from 'js/awPromiseService';
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphPathsService from 'js/graphPathsService';
import occmgmtUtils from 'js/occmgmtUtils';
import cdm from 'soa/kernel/clientDataModel';

/**
 * return visible nodes on the graph
 * @param {Object} graphModel graph model
 * @returns {Array} visible nodes
 */
export let getVisibleNodes = function( graphModel ) {
    var visibleObjectsList = [];

    const nodeModels = graphModel.dataModel.nodeModels;
    _.forEach( nodeModels, function( value ) {
        visibleObjectsList.push( value.modelObject );
    } );
    return visibleObjectsList;
};

/**
 * Check that input object type contains only required properties that can be skipped while object creation and can
 * be assigned on server or not. Based on that it will return true or false callback status
 *
 * @param {string} objectTypeName Object type to be check
 * @param {array} skipPropertyList List that will contain required property names that can be skipped and assign on server
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let canObjectQuickCreated = function( objectTypeName, skipPropertyList ) {
    var deferred = AwPromiseService.instance.defer();
    if( objectTypeName ) {
        exports.getCreateIType( objectTypeName ).then(
            function( response ) {
                var canBeCreate = true;
                if( response ) {
                    var requiredProperties = [];
                    getRequiredProperties( response, requiredProperties );
                    if( requiredProperties.length > 0 ) {
                        canBeCreate = checkIfArrayDoNotIncludeReqProp( requiredProperties, skipPropertyList );
                    }
                    deferred.resolve( canBeCreate );
                }
            },
            function( error ) {
                deferred.reject( error );
            }
        );
    } else {
        deferred.resolve( false );
    }

    return deferred.promise;
};

/*
 * Check if required property name list is not null then check each property exist in
 * input property name. If not then return false.
 *
 * @param {array} requiredProperties required property list
 * @param {array} skipPropList List that will contain required property names that can be skipped and assign on server
 */
var checkIfArrayDoNotIncludeReqProp = function( requiredProperties, skipPropList ) {
    var isQuickCreate = true;
    _.forEach( requiredProperties, function( prop ) {
        if( !_.includes( skipPropList, prop ) ) {
            isQuickCreate = false;
            return isQuickCreate;
        }
    } );
    return isQuickCreate;
};

/**
 * To check the property descriptor for input model type and add the required properties that is needed to create
 * the input object type.
 *
 * @param {Object} createInputType modelType IModelType object
 * @param {array} requiredProperties requiredPropNames Required property names list
 */
var getRequiredProperties = function( createInputType, requiredProperties ) {
    var propertyDescriptorsMap = null;
    if( createInputType && createInputType.propertyDescriptorsMap ) {
        propertyDescriptorsMap = createInputType.propertyDescriptorsMap;
    }
    // Check if property descriptor is not null and not empty
    // then only process further
    if( propertyDescriptorsMap ) {
        //Iterate for each property descriptor and check if it's required or not
        _.forEach( propertyDescriptorsMap, function( propDescription ) {
            if( propDescription.constantsMap && propDescription.constantsMap.required ) {
                var isRequired = false;
                isRequired = propDescription.constantsMap.required === '1';

                // Check if property is required then check if property name exist in the
                // input property list
                if( isRequired ) {
                    var propName = propDescription.name;
                    var compoundObjectUid = null;
                    if( propDescription.compoundObjType ) {
                        // Check if compound object type UID is null and property is display to true also
                        //property initial value is null or empty then add it to required property list
                        compoundObjectUid = propDescription.compoundObjType;
                    }

                    if( !compoundObjectUid && propDescription.constantsMap.displayable === '1' &&
                        ( !propDescription.constantsMap.initialValue || _.isEmpty( propDescription.constantsMap.initialValue ) ) ) {
                        if( !_.includes( requiredProperties, propName ) ) {
                            requiredProperties.push( propName );
                        }
                    } else if( compoundObjectUid ) {
                        var childCreateDescriptorTypeName = getModelTypeNameFromUid( compoundObjectUid );
                        if( childCreateDescriptorTypeName ) {
                            var childCreateDescriptorType = cmm.getType( childCreateDescriptorTypeName );
                            getRequiredProperties( childCreateDescriptorType, requiredProperties );
                        }
                    }
                }
            }
        } );
    }
};

/**
 * return required property list
 *
 * @param {string} typeName IModelType object name
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let getCreateIType = function( typeName ) {
    var deferred = AwPromiseService.instance.defer();
    var promise = soaSvc.ensureModelTypesLoaded( [ typeName ] );
    var createInputTypeNameList = [ typeName ];
    promise
        .then( function() {
            var typeNameType = cmm.getType( typeName );
            if( typeNameType ) {
                var creI = typeNameType.constantsMap.CreateInput;
                if( creI ) {
                    var creIType = cmm.getType( creI );
                    if( !creIType ) {
                        soaSvc
                            .ensureModelTypesLoaded( [ creI ] )
                            .then(
                                function() {
                                    var creIType = cmm.getType( creI );
                                    if( creIType ) {
                                        createInputTypeNameList.push( creIType.name );
                                        loadChildCreateDescriptors( createInputTypeNameList ).then(
                                            function( response ) {
                                                deferred.resolve( creIType );
                                            },
                                            function( error ) {
                                                deferred.reject( error );
                                            } );
                                    }
                                } );
                    } else {
                        createInputTypeNameList.push( creIType.name );
                        deferred.resolve( creIType );
                    }
                }
            }
        } );

    return deferred.promise;
};

/**
 * Recursively load the child create descriptors
 *
 * @param {array} createInputTypeNameList name list of model type
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
var loadChildCreateDescriptors = function( createInputTypeNameList ) {
    var deferred = AwPromiseService.instance.defer();

    var typeNamesToLoad = [];
    _.forEach( createInputTypeNameList, function( creatInputType ) {
        var modelType = cmm.getType( creatInputType );
        _.forEach( modelType.propertyDescriptorsMap, function( propDescription ) {
            if( propDescription.compoundObjType ) {
                var typeName = getModelTypeNameFromUid( propDescription.compoundObjType );
                if( typeName && !cmm.containsType( typeName ) ) {
                    typeNamesToLoad.push( typeName );
                }
            }
        } );
    } );

    if( typeNamesToLoad.length > 0 ) {
        var promise = soaSvc.ensureModelTypesLoaded( typeNamesToLoad );
        promise.then(
            function( response ) {
                loadChildCreateDescriptors( typeNamesToLoad );
                deferred.resolve( response );
            },
            function( error ) {
                deferred.reject( error );
            } );
    } else {
        deferred.resolve( null );
    }
    return deferred.promise;
};

/**
 * extract type name from uid
 *
 * @param {string} uid model type uid
 * @returns {String} model type name
 */
var getModelTypeNameFromUid = function( uid ) {
    var tokens = uid.split( '::' );
    if( tokens.length === 4 && tokens[ 0 ] === 'TYPE' ) {
        return tokens[ 1 ];
    }
    return null;
};

var getVisibleRootNodes = function( graphModel ) {
    var visibleNodes = graphModel.graphControl.graph.getVisibleNodes();
    if( visibleNodes ) {
        return _.filter( visibleNodes, function( item ) {
            return item.isRoot();
        } );
    }
    return [];
};

var getNextLevelNodes = function( graphModel, nodesToRemove, edgesToRemove ) {
    return function( node ) {
        var nextLevelNodes = [];
        var groupedGraph = graphModel.graphControl.groupGraph;
        if( node.getItemType() !== 'Node' ) {
            return;
        }
        var edges = node.getEdges();
        if( edgesToRemove && edgesToRemove.length > 0 ) {
            edges = _.difference( edges, edgesToRemove );
        }
        var visibleEdges = _.filter( edges, function( edge ) {
            return !edge.isFiltered();
        } );

        _.forEach( visibleEdges, function( edge ) {
            if( edge.getSourceNode() === node ) {
                var targetNode = edge.getTargetNode();
                if( targetNode ) {
                    nextLevelNodes.push( targetNode );
                }
            } else if( edge.getTargetNode() === node ) {
                var sourceNode = edge.getSourceNode();
                if( sourceNode ) {
                    nextLevelNodes.push( sourceNode );
                }
            }
        } );

        var groupRelationCategory = graphModel.categoryApi.getGroupRelationCategory();
        var activeLegendView = appCtxSvc.getCtx( 'graph.legendState.activeView' );

        var category = _.find( activeLegendView.filteredCategories, function( category ) {
            return category.internalName === groupRelationCategory;
        } );
        if( !category ) {
            var children = node.getGroupMembers();
            var parent = groupedGraph.getParent( node );
            if( children ) {
                nextLevelNodes = nextLevelNodes.concat( children );
            }
            if( parent ) {
                nextLevelNodes.push( parent );
            }
        }

        nextLevelNodes = _.uniq( nextLevelNodes );
        if( nodesToRemove && nodesToRemove.length > 0 ) {
            nextLevelNodes = _.difference( nextLevelNodes, nodesToRemove );
        }
        nextLevelNodes = _.filter( nextLevelNodes, function( node ) { return !node.isFiltered(); } );
        return nextLevelNodes;
    };
};

export let getUnconnectedItems = function( graphModel, nodesToRemove, edgesToRemove ) {
    var unconnectedItems = [];
    //based on all visible graph items
    var visibleNodes = graphModel.graphControl.graph.getNodes();
    if( visibleNodes ) {
        var rootNodes = getVisibleRootNodes( graphModel );
        if( rootNodes && rootNodes.length > 0 ) {
            if( nodesToRemove && nodesToRemove.length > 0 ) {
                rootNodes = _.difference( rootNodes, nodesToRemove );
            }
            var connectedItems;
            connectedItems = graphPathsService.getConnectedGraph( rootNodes, getNextLevelNodes( graphModel, nodesToRemove, edgesToRemove ) );
            unconnectedItems = _.difference( visibleNodes, connectedItems );
        }
    }
    return unconnectedItems;
};

/**
 * @param {string} commandId panel id
 * @param {string} commandLocation location where panel will open
 * @param {object} context context to be passed to the panel
 */
export let openRequiredCommandPanel = function( commandId, commandLocation, context ) {
    commandPanelService.activateCommandPanel( commandId, commandLocation, context );
};

/**
 * Changes the visibility state of a Graph Item
 * @param {Object} graphItem graph item whose visibility is to be changes
 * @param {Object} graphState Architecture graph state
 */
export let setLabelVisibilityOnGraphItem = function( graphItem, graphState ) {
    var labelCategories = [];
    if( graphState && graphState.labelCategories ) {
        labelCategories = graphState.labelCategories;
    }
    var label = graphItem.getLabel();
    if( graphItem ) {
        var state = _.find( labelCategories, {
            internalName: graphItem.category
        } );
        if( state.categoryState ) {
            label.setVisible( true );
        } else {
            label.setVisible( false );
        }
    }
};

/**
 * Gets create input object given categoryType and displayName
 * of the subcategory
 *
 * @param {string} categoryType  type of the subcategory
 * @param {string} categoryDisplayName display name of the subcategory
 *
 * @returns {Object} create input object
 */
export let getCreateInput = function( categoryType, categoryDisplayName ) {
    if( categoryDisplayName ) {
        return {
            boName: categoryType,
            propertyNameValues: {
                object_name: [ categoryDisplayName ]
            },
            compoundCreateInput: {}
        };
    }
    return {
        boName: categoryType,
        propertyNameValues: {},
        compoundCreateInput: {}
    };
};

/**
 * Shows text Editor for newly created dummy node
 *
 * @param {object} graphModel graphmodel data
 * @param {object} node node to be edit
 *
 * @returns {Object} Promise for edit node property
 */
export let showTextEditor = function( graphModel, node ) {
    // by default, create a deferred promise with reject
    var deferred = AwPromiseService.instance.defer();
    //deferred.reject();
    if( !graphModel || !node ) {
        return deferred.promise;
    }
    // show inline editor
    var nodePropertyEditHandler = graphModel.graphControl.nodePropertyEditHandler;
    if( nodePropertyEditHandler ) {
        //find the name element
        var property = 'Name';
        var selector = 'text.aw-graph-modifiableProperty[data-property-name="Name"]';
        var nameElement = $( selector, node.getSVGDom() );
        if( nameElement && nameElement[ 0 ] ) {
            return nodePropertyEditHandler.editNodeProperty( node, nameElement[ 0 ], property, node
                .getProperty( property ) );
        }
    }

    return deferred.promise;
};

//update edge style as per applied filter
export let updateEdgeStyle = function( edge, edgeStyle, graph, tarNode ) {
    //update the edge style as per the filter applied
    var srcPort = edge.getSourcePort();
    if( cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType ) ) {
        if( !srcPort.isFiltered() ) {
            if( edgeStyle.sourceArrow ) {
                delete edgeStyle.sourceArrow;
            }
            if( edgeStyle.targetArrow && tarNode.isVisible() ) {
                delete edgeStyle.targetArrow;
            }
        }
        graph.setEdgeStyle( edge, edgeStyle );
    }
};

/**
 * Check whether to select connection/node in primary work area.
 *
 * @param {string} parentUid parent element uid of the object
 * @param {string} objectUid object uid to select,
 * @param {boolean} isConnection flag to tell if object to select is connection
 * @param {object} occContext occmgmt Context
 */
export let checkWhetherToSelectObjectInAce = function( parentUid, objectUid, isConnection, occContext ) {
    if( !parentUid ||  isConnection && ( occContext.persistentRequestPref && !occContext.persistentRequestPref.includeConnections )  ) {
        return;
    }

    let newObject = cdm.getObject( objectUid );
    if( newObject ) {
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', {
            elementsToSelect:[ newObject ], overwriteSelections : true
        }, occContext );
    }
};

/**
 * execute createRelateAndSubmitObjects soa call
 *
 * @param {object} creInput create input
 */
export let executeCreateObject = function( creInput ) {
    eventBus.publish( 'AMCreateObjectEvent', { createInput: creInput } );
};

/**
 * Toggle boolean value in state
 * @param {object} state state
 * @param {object} keyPath value path
 */
export let toggleBooleanStateValue = function( state, keyPath ) {
    if( state && state.value ) {
        const newState = { ...state.value };
        let currentValue = _.get( newState, keyPath, false );
        _.set( newState, keyPath, !currentValue );
        state.update( newState );
    }
};

const exports = {
    getVisibleNodes,
    canObjectQuickCreated,
    getCreateIType,
    getUnconnectedItems,
    openRequiredCommandPanel,
    setLabelVisibilityOnGraphItem,
    getCreateInput,
    showTextEditor,
    updateEdgeStyle,
    checkWhetherToSelectObjectInAce,
    executeCreateObject,
    toggleBooleanStateValue
};
export default exports;
