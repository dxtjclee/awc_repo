// Copyright (c) 2022 Siemens

/**
 * Service to create Object
 *
 * @module js/ssp0CreateObjectService
 */

import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import soaService from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';

let exports = {};

const RESOURCE_MESSAGE = 'ServicePlannerConstants';

const messagesMap = new Map();
messagesMap.set( servicePlannerConstants.TYPE_WORK_CARD_PROCESS, servicePlannerConstants.MSG_WC_CREATED );
messagesMap.set( servicePlannerConstants.TYPE_SERVICE_CONTAINER_PROCESS, servicePlannerConstants.MSG_SC_CREATED );
messagesMap.set( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS, servicePlannerConstants.MSG_SR_CREATED );
messagesMap.set( servicePlannerConstants.TYPE_SKILL_PROCESS, servicePlannerConstants.MSG_SK_CREATED );

const typesMap = new Map();
typesMap.set( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS, servicePlannerConstants.TYPE_SERVICE_PLAN_REVISION );
typesMap.set( servicePlannerConstants.TYPE_WORK_CARD_PROCESS, servicePlannerConstants.TYPE_WORK_CARD_REVISION );
typesMap.set( servicePlannerConstants.TYPE_SERVICE_CONTAINER_PROCESS, servicePlannerConstants.TYPE_SERVICE_CONTAINER_REVISION );
typesMap.set( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS, servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_REVISION );

let _addRelatedObjects = function( body, selectedVMO ) {
    if ( body.saveInput ) {
        if ( body.saveInput.relatedObjects === undefined ) {
            body.saveInput.relatedObjects = {};
        }
        body.saveInput.relatedObjects[selectedVMO.uid] = {
            uid: selectedVMO.uid,
            type: selectedVMO.type
        };
    }
};

let _initSectionInput = function( sectionName, sectionOject ) {
    return {
        saveInput: {
            sections: [
                {
                    sectionName: sectionName,
                    dataEntries: [
                        {
                            entry: {
                                Object: {
                                    nameToValuesMap: sectionOject
                                }
                            }
                        }
                    ]
                }
            ]
        }
    };
};

let _addEntries = function( input, entryName, data ) {
    if ( data ) {
        input[entryName] = {};
        input[entryName].nameToValuesMap = data;
    }
};

/**
 * create Input Object for the SOA
 * @param {Object} data data
 * @param {String} createType createType
 * @return {Object} result of the SOA
 */
export let getCreateInputSkill = function( data, createType ) {
    const getCreateInput = addObjectUtils.getCreateInput( data, '', createType );
    let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
    if ( selectedVMO.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS ) ) {
        let tempSelectedVMO = {};
        tempSelectedVMO.uid = selectedVMO.servicePartitionUid;
        tempSelectedVMO.type = servicePlannerConstants.TYPE_SERVICE_PARTITION_PROCESS;
        selectedVMO = tempSelectedVMO;
    }
    const itemPropertyNamesValues = getCreateInput[0].createData.propertyNameValues;
    const revPropertyNamesValues = getCreateInput[0].createData.compoundCreateInput.revision[0].propertyNameValues;
    const nameToValuesMap = {
        Type: [
            createType
        ],
        connectTo: [
            selectedVMO.uid
        ]
    };
    let body = _initSectionInput( 'ObjectsToCreate', nameToValuesMap );

    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    // add item props
    _addEntries( entryAnchor, 'ItemProps', itemPropertyNamesValues );
    // add revision props
    _addEntries( entryAnchor, 'RevProps', revPropertyNamesValues );

    _addRelatedObjects( body, selectedVMO );

    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body ).then( function( result ) {
        if ( result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues ) {
            msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
            return result;
        }
        let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
        msgSvc.showInfo( localTextBundle[messagesMap.get( result.saveResults[0].saveResultObject.modelType.typeHierarchyArray[0] )] );
        return result;
    } );
};
export let getCreateInput = function( data, createType ) {
    const getCreateInput = addObjectUtils.getCreateInput( data, '', createType );
    const policy = {
        types: [
            {
                name: 'SSP0BvrServiceRequirement',
                properties: [
                    {
                        name: 'Mfg0predecessors'
                    },
                    {
                        name: 'bl_rev_fnd0objectId'
                    },
                    {
                        name: 'bl_child_lines'
                    }
                ]
            } ]
    };
    policySvc.register( policy );
    let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
    if ( selectedVMO.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS ) ) {
        let tempSelectedVMO = {};
        tempSelectedVMO.uid = selectedVMO.servicePartitionUid;
        tempSelectedVMO.type = servicePlannerConstants.TYPE_SERVICE_PARTITION_PROCESS;
        selectedVMO = tempSelectedVMO;
    }
    const itemPropertyNamesValues = getCreateInput[0].createData.propertyNameValues;
    const revPropertyNamesValues = getCreateInput[0].createData.compoundCreateInput.revision[0].propertyNameValues;
    const nameToValuesMap = {
        Type: [
            createType
        ],
        connectTo: [
            selectedVMO.uid
        ]
    };
    let body = _initSectionInput( 'ObjectsToCreate', nameToValuesMap );

    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    // add item props
    _addEntries( entryAnchor, 'ItemProps', itemPropertyNamesValues );
    // add revision props
    _addEntries( entryAnchor, 'RevProps', revPropertyNamesValues );

    _addRelatedObjects( body, selectedVMO );

    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body ).then( function( result ) {
        if ( result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues ) {
            if(result.ServiceData.partialErrors[0].errorValues[0].code === 200378){
                eventBus.publish('servicePlanTreeTable.plTable.reload', {
                    retainTreeExpansionStates: true
                });
                return;
            }
            else {
                msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
                return result;
            }
        }
        let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
        msgSvc.showInfo( localTextBundle[messagesMap.get( result.saveResults[0].saveResultObject.modelType.typeHierarchyArray[0] )] );
        let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
        let modelObjects = result.ServiceData.modelObjects;
        let childNodeUid = result.saveEvents.filter( element => element.eventType === 'create' )[0].eventObjectUid;
        let childNode = getChildNode( modelObjects, childNodeUid );
        if ( selectedVMO && selectedVMO.isExpanded ) {
            eventBus.publish( 'SSP0ServicePlanTree.newNodeAdded', {
                soaResult: result,
                childNodeUid: childNode.uid
            } );
        } else {
            eventBus.publish( 'expandSelectedNode', {
                nodeToBeExpanded: selectedVMO,
                nodeToBeSelected: childNode
            } );
        }
        return result;
    } );
};

function newNodeAdded( result, dataProvider ) {
    let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
    let childNode = getChildNode( result.modelObjects, result.plain[0] );
    const parentTreeNode = getTreeNode( dataProvider, selectedVMO );
    appendChildNodes( parentTreeNode, childNode, dataProvider );
}

function getChildNode( modelObjects, childNodeUid ) {
    return Object.values( modelObjects ).filter( modelObject => modelObject.uid === childNodeUid )[0];
}

/**
   * get Tree Node from dataProvider
   *
   * @param {Object} dataProvider - the save events as json object
   * @param {Object} modelObject - event Type
   *
   * @returns {Object} the tree node
   */
function getTreeNode( dataProvider, modelObject ) {
    return modelObject && _.find( dataProvider.viewModelCollection.getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === modelObject.uid );
}

export function appendChildNodes( parentTreeNode, childObjects, dataProvider ) {
    if ( !parentTreeNode.children ) {
        parentTreeNode.children = [];
    }
    parentTreeNode.isLeaf = false;
    const childIndex = parentTreeNode.children.length;
    let childNdx = childIndex;
    const childTreeNodes = getTreeNodeObject( childObjects, parentTreeNode, true, childNdx++ );
    const loadedVmos = [ ...dataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let refIndex = loadedVmos.indexOf( parentTreeNode );
    const descendantTreeNodes = getAllDescendantTreeNodes( parentTreeNode );
    descendantTreeNodes.forEach( descendant => {
        let index = loadedVmos.indexOf( descendant );
        if ( index > refIndex ) {
            refIndex = index;
        }
    } );
    loadedVmos.splice( refIndex + 1, 0, childTreeNodes );
    parentTreeNode.children.splice( childIndex, 0, childTreeNodes );

    dataProvider.update( loadedVmos, loadedVmos.length );
    setSelectionOfAddedNode( dataProvider, childTreeNodes );
}

function setSelectionOfAddedNode( dataProvider, nodeToSelect ) {
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    const loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToSelect.uid );
    dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
}

/**
 * Returns all of the decendant tree nodes
 * @param {ViewModelTreeNode} treeNode - a given tree node object
 * @return {ViewModelTreeNode[]} array of tree node objects
 */
export function getAllDescendantTreeNodes( treeNode ) {
    const descendants = [];
    if ( !treeNode.isLeaf && treeNode.children && treeNode.children.length > 0 ) {
        treeNode.children.forEach( ( childTreeNode ) => {
            descendants.push( ...getAllDescendantTreeNodes( childTreeNode ) );
        } );
        descendants.push( ...treeNode.children );
    }
    return descendants;
}

/**
 * getTreeNodeObject
 *
 * @param {Object} nodeObject - model object or view model object
 * @param {Object} parentNode - the parent node
 * @param {boolean} isLeaf - check if node has further children
 * @param {int} childNdx - child index
 *
 * @return {Object} vmNode - tree node object
 */
export function getTreeNodeObject( nodeObject, parentNode, isLeaf, childNdx, displayNameProp = 'object_string' ) {
    if ( !viewModelObjectService.isViewModelObject( nodeObject ) ) {
        nodeObject = viewModelObjectService.createViewModelObject( nodeObject );
    }
    let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( nodeObject, 'create' );
    if ( nodeObject.props.bl_item_object_name ) {
        vmo.displayName = nodeObject.props.bl_item_object_name.dbValues[0];
        vmo.levelNdx = parentNode.levelNdx + 1;
        vmo.underlyingObjectType = nodeObject.type;
        vmo.isVisible = false;
    }
    if ( nodeObject.props.bl_has_children ) {
        vmo.isLeaf = nodeObject.props.bl_has_children.dbValues[0] === '0';
    }
    vmo.alreadyExpanded = false;
    if ( !vmo.props ) {
        vmo.props = nodeObject.props;
    }
    return vmo;
}

/**
 * create Input Object for set Occurrence Type
 * @param {Object} selectedVMO VMO selected in Parts View
 * @param {Object} occType Occurrence Type
 * @return {Object} result of the SOA
 */
export let createObjectOfSetOccType = function( selectedVMO, occType ) {
    let body = _initSectionInput( 'ObjectsToModify', {
        id: [
            selectedVMO.uid
        ]
    } );
    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    _addEntries( entryAnchor, 'Prop', {
        bl_occ_type: [
            occType
        ]
    } );

    const parentVMO = appCtxService.getCtx( 'selectedVMO' );
    _addRelatedObjects( body, selectedVMO );
    _addRelatedObjects( body, parentVMO );
    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body ).then( function( result ) {
        eventBus.publish( 'reloadPartsTree' );
        eventBus.publish( 'reloadToolsTree' );
        return result;
    } );
};

let _createSection = function( body, sectionName, sectionOject ) {
    let dataEntries = {
        entry: {
            Object: {
                nameToValuesMap: sectionOject
            }
        }
    };
    if ( body.saveInput.sections.length === 0 ) {
        body.saveInput.sections[0] = {
            sectionName: sectionName,
            dataEntries: [ dataEntries ]

        };
    } else {
        body.saveInput.sections[0].dataEntries.push( dataEntries );
    }
    return body;
};
let _createPropertyPolicy = function( policyMap ) {
    let policy = { types: [] };
    for ( const [ key, value ] of policyMap.entries() ) {
        let properties = [];
        value.forEach( propertyName => {
            properties.push( { name: propertyName } );
        } );

        policy.types.push( { name: key, properties: properties } );
        properties.push( { name: 'bl_line_object', modifiers: [ { name: 'withProperties', Value: 'true' } ] } );
        policy.types.push( { name: typesMap.get( key ), properties: properties } );
    }
    return policy;
};

/**
 * Get the Value from viewModel and set it on Data
 *
 * @param {String} propertyToUpdate propertyToUpdate
 * @param {String} value value
 * @param {Object} dataToUpdate dataToUpdate
 * @returns {Object} value
 */
export let getValueInViewModel = function( propertyToUpdate, value, dataToUpdate ) {
    let cloneData = _.clone( dataToUpdate );
    cloneData[propertyToUpdate] = value;
    return cloneData;
};

/**
 * Create Object to modify object
 *
 * @param {String} dataProvider dataProvider
 * @returns {Object} Promise
 */
export let createObjectOfModifyType = function( dataProvider ) {
    let modifiedObjects = dataProvider.viewModelCollection.getAllModifiedProperties();
    if ( modifiedObjects.length > 0 ) {
        let bodyOfSet = {
            saveInput: {
                sections: []
            }
        };
        let updatedVMOs = [];
        let policyMap = new Map();
        modifiedObjects.forEach( ( obj, index ) => {
            bodyOfSet = _createSection( bodyOfSet, 'ObjectsToModify', { id: [ obj.viewModelObject.uid ] } );
            let entryAnchor = bodyOfSet.saveInput.sections[0].dataEntries[index].entry;
            let propObject = {};
            if ( obj.property.propertyName === 'bl_uom' ) {
                propObject[obj.property.propertyName] = [ obj.property.displayValues[0] ];
            } else {
                propObject[obj.property.propertyName] = [ obj.property.dbValue ];
            }
            if ( obj.property.propertyName === 'bl_rev_object_name' ) {
                obj.viewModelObject.displayName = obj.property.displayValues[0];
            }

            _addEntries( entryAnchor, 'Prop', propObject );

            if ( policyMap.get( obj.viewModelObject.type ) === undefined ) {
                policyMap.set( obj.viewModelObject.type, [ obj.property.propertyName ] );
            } else {
                let properties = policyMap.get( obj.viewModelObject.type );
                properties.push( obj.property.propertyName );
                policyMap.set( obj.viewModelObject.type, properties );
            }
            _addRelatedObjects( bodyOfSet, obj.viewModelObject );
            updatedVMOs.push( obj.viewModelObject );
        } );
        let policy = _createPropertyPolicy( policyMap );


        policySvc.register( policy );
        return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', bodyOfSet ).then( function( result ) {
            if ( result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues ) {
                msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
                return result;
            }
            let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
            let objectSelected = Object.values( modifiedObjects ).filter( modelObject => modelObject.viewModelObject.uid === selectedVMO.uid );
            if ( objectSelected.length === 1 ) {
                let vmo = cdm.getObject( selectedVMO.uid );
                let revisionVMO = cdm.getObject( selectedVMO.props.bl_rev_fnd0objectId.dbValues[0] );
                eventBus.publish( 'cdm.modified', { modifiedObjects: [ revisionVMO ] } );
                appCtxService.updateCtx( 'selected', revisionVMO );
                appCtxService.updateCtx( 'selectedVMO', vmo );
                appCtxService.updateCtx( 'pselected', revisionVMO );
                appCtxService.updateCtx( 'mselected', [ revisionVMO ] );
                appCtxService.updateCtx( 'mselectedVMO', [ vmo ] );
            }
            eventBus.publish( 'servicePlanTreeTable.plTable.updated', { updatedObjects: updatedVMOs } );
            return AwPromiseService.instance.resolve();
        } );
    }
};
/**
 * get parent node attributes
 * @return {Array} array of properties to load
 */
let getParentNodeAttributes = function(  ) {
    let attributes = [
        'awb0RevisionOwningGroup',
        'bl_rev_checked_out',
        'awb0RevisionLastModifiedUser',
        'awb0RevisionOwningUser',
        'bl_has_children',
        'bl_child_lines',
        'bl_item_object_name',
        'bl_item_item_id',
        'bl_occ_type',
        'bl_item_object_desc',
        'bl_line_object',
        'bl_parent',
        'awp0ThumbnailImageTicket',
        'bl_quick_num_children',
        'Mfg0predecessors',
        'bl_rev_fnd0objectId',
        'bl_bomview_rev'
    ];

    let columnsFromServer = appCtxService.getCtx( 'servicePlanProperties' );

    return attributes.concat( columnsFromServer );
};

export default exports = {
    getValueInViewModel,
    createObjectOfModifyType,
    getCreateInput,
    createObjectOfSetOccType,
    newNodeAdded,
    getCreateInputSkill,
    getParentNodeAttributes
};
