// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to load Part
*
* @module js/Ssp0ActivityPartsService
*/
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import awColumnSvc from 'js/awColumnService';
import iconService from 'js/iconService';
import { constants as timeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaService from 'soa/kernel/soaService';


let exports = {};

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadPartsTreeTableColumns = async function( i18n ) {
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    let servercolumns = [];
    const firstColumnConfigCol = {
        name: 'bl_line_name',
        displayName: i18n.nameValueColumn,
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true,
        columnOrder: 1,
        propertyName: 'object_string',
        pixelWidth: 200,
        hiddenFlag: false
    };
    const secondColumnConfigCol = {
        name: 'bl_occ_type',
        displayName: i18n.occurrenceTypeColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false,
        columnOrder: 2,
        propertyName: 'bl_occ_type',
        pixelWidth: 200,
        hiddenFlag: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    var input = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            scopeName: '',
            clientName: 'AWClient',
            resetColumnConfig: true,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Ssp0PartTableManagement',
                operationType: 'OVERWRITE',
                typeNames: [],
                columnsToExclude: []
            } ],
            businessObjects: [
                {}
            ]
        } ]
    };
    await soaService.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', input ).then( function( response ) {
        servercolumns = response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
    } );
    if( servercolumns.length > 0 ) {
        servercolumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0PartTableManagement',
            objectSetUri: 'Ssp0PartTableManagement'
        }
    } );

    return deferred.promise;
};

/**
 * Get part nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} data data of ViewModel
 * @return {Array.Object} Array of modelObjects
 */
export const getActivityParts = function( response, data ) {
    if ( response && response.plain ) {
        const selectedVMO = response.plain[0];
        let modelObjects = undefined;
        if ( response.modelObjects ) {
            modelObjects = response.modelObjects;
        } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
            modelObjects = response.ServiceData.modelObjects;
        }
        let found = false;
        let input = [];
        data.childExist = false;
        if ( modelObjects && modelObjects[selectedVMO].uid && modelObjects[selectedVMO].props.al_activity_tool_bl_list && modelObjects[selectedVMO].props.al_activity_tool_bl_list.dbValues.length > 0 ) {
            found = true;
            data.childExist = true;
            const objects = modelObjects[selectedVMO].props.al_activity_tool_bl_list.dbValues;
            input = _getMfg0BvrPartObjects( objects );
            return input;
        }

        if ( !found ) {
            data.treeLoadResult = { response: [], totalFound: 0 };
        }
        return input;
    }
};

/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} data data
 * @return {Object} TreeLoadResult of node
 */
export let setTreeProperties = function( response, data ) {
    let objectsToReturn = [];
    if ( response.modelObjects !== undefined ) {
        const modelObjects = response.modelObjects || response.data.modelObjects;
        Object.values( modelObjects ).filter( modelObject => modelObject.props && modelObject.props.bl_line_name
            && modelObject.props.bl_occ_type && modelObject.props.bl_item_object_type && modelObject.modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_PART_PROCESS ) ).forEach(
            modelObject => {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject, 'create', undefined, undefined, true );
                if ( vmo.props.bl_occ_type ) {
                    let vmProp = uwPropertySvc.createViewModelProperty( 'bl_occ_type', 'Occurrence Type', 'STRING',
                        vmo.props.bl_occ_type.dbValues[0], [ vmo.props.bl_occ_type.dbValues[0] ] );
                    uwPropertySvc.setIsEditable( vmProp, false );
                    uwPropertySvc.setEditState( vmProp, false );
                    uwPropertySvc.setHasLov( vmProp, true );
                    uwPropertySvc.setIsRequired( vmProp, true );
                    vmo.props.bl_occ_type = vmProp;
                }
                if ( vmo.props.bl_item_object_desc ) {
                    vmo.props.bl_item_object_desc.isPropertyModifiable = false;
                    vmo.props.bl_item_object_desc.isEditable = false;
                }
                vmo.propertyDescriptor = {
                    displayName: vmo.propertyDisplayName
                };
                vmo.getViewModel = function() {
                    return data;
                };
                vmo.displayName = modelObject.props.bl_line_name.dbValues[0];
                let parentObject = Object.values( modelObjects ).filter( modelObject => modelObject.uid === vmo.props.bl_rev_fnd0objectId.dbValues[0] );
                vmo.typeIconURL = _getIconURL( parentObject[0] );
                vmo.isVisible = false;
                vmo.isLeaf = true;
                objectsToReturn.push( vmo );
            } );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};

let _getIconURL = function( parentObject ) {
    if ( parentObject.modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_PART_REVISION_TYPE_HIERARCHY ) ) {
        return iconService.getTypeIconURL( timeAnalysisConstants.TYPE_PART_REVISION );
    }
    return iconService.getTypeIconURL( timeAnalysisConstants.TYPE_ITEM_REVISION );
};

let _getMfg0BvrPartObjects = function( objects ) {
    let input = [];
    objects.forEach( o => input.push( {
        uid: o
    } ) );
    return input;
};

export default exports = {
    getActivityParts,
    setTreeProperties,
    loadPartsTreeTableColumns
};
