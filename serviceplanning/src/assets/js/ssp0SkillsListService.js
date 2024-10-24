// Copyright (c) 2023 Siemens

/**
 * @module js/ssp0SkillsListService
 */
import localeService from 'js/localeService';
import iconService from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import awColumnSvc from 'js/awColumnService';
import ssp0ColumnArrangeService from 'js/ssp0ColumnArrangeService';
import _ from 'lodash';

let exports = {};

/**
 * this method will update current selection
 *
 * @param {Object} vmo will be the current selection list
 * */
let registerSkillInCtx = function( vmo ) {
    if( vmo && vmo.length >= 1 ) {
        if( !appCtxService.ctx.ssp0SelectedSkill ) {
            appCtxService.registerCtx( 'ssp0SelectedSkill', vmo );
        }else{
            appCtxService.updateCtx( 'ssp0SelectedSkill', vmo );
        }
    } else if( vmo.length <= 0 && appCtxService.ctx.ssp0SelectedSkill ) {
        appCtxService.unRegisterCtx( 'ssp0SelectedSkill' );
    }
};
let getResponseAndTotalFound = function( response ) {
    let modelObjects = undefined;
    var onlySkills = [];
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    const plain = response.plain[0];
    const skillParentObject = Object.values( modelObjects ).filter( modelObject =>
        plain.includes( modelObject.uid ) );
    if( skillParentObject ) {
        const allSkills = skillParentObject[0].props.bl_child_lines.dbValues;
        for( let i = 0; i < allSkills.length; i++ ) {
            let filterObject = Object.values( modelObjects ).filter( modelObject =>
                modelObject.uid === allSkills[i] )[0];
            if( filterObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SKILL_PROCESS )  ) {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( filterObject, 'create', undefined, undefined, true );
                vmo.typeIconURL = iconService.getTypeIconURL( servicePlannerConstants.TYPE_SKILL_REVISION );
                vmo.displayName = filterObject.props.object_string.dbValues[0];
                vmo.isVisible = false;
                vmo.isLeaf = true;
                onlySkills.push( vmo );
            }
        }
        var actualTotalFound = onlySkills.length;
        if( appCtxService.getCtx( 'actualTotalFound' ) ) {
            appCtxService.updateCtx( 'actualTotalFound', actualTotalFound );
        } else{
            appCtxService.registerCtx( 'actualTotalFound', actualTotalFound );
        }
    }
    return { onlySkills, actualTotalFound };
};

let loadSkillsTableColumnConfig = async function( resetFlag ) {
    var resource = 'ServicePlannerConstants';
    var localizeDisplayName = localeService.getLoadedText( resource );
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    let serverColumns = [];
    const firstColumnConfigCol = {
        name: 'object_string',
        displayName: localizeDisplayName.skill_name,
        typeName: 'Awb0Element',
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
        displayName: localizeDisplayName.skill_occType,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        renderingHint: 'OccurrenceTypeProvider',
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
            resetColumnConfig: resetFlag,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Ssp0SkillsTableManagement',
                operationType: 'union',
                typeNames: [],
                columnsToExclude: []
            } ],
            businessObjects: [
                {}
            ]
        } ]
    };
    await soaService.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', input ).then( function( response ) {
        serverColumns = response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
    } );
    if( serverColumns.length > 0 ) {
        serverColumns.forEach( column => {
            if( column.propertyName !== 'object_string' ) { awColumnInfos.push( column ); }
        } );
    }
    ssp0ColumnArrangeService.saveColumnConfigToCtx( serverColumns, 'Ssp0SkillsTableManagement' );

    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0SkillsTableManagement',
            objectSetUri: 'Ssp0SkillsTableManagement'
        }
    } );

    return deferred.promise;
};

/**
 * This function disconnects consumed selected part/parts from WC/SR
 *
 * @param {Array} sourceObjects - selected parts element
 * @param {Object} target - WC/SR
 */
export let unAssignSkill = function( sourceObjects, target ) {
    let input = [];
    for ( let sourceObject of sourceObjects ) {
        input.push( {
            disconnectFrom: {
                uid: target.uid,
                type: target.type
            },
            clientId: '',
            relationName: '',
            object: {
                uid: sourceObject.uid,
                type: sourceObject.type
            }
        } );
    }
    soaService.postUnchecked( 'Manufacturing-2009-10-DataManagement', 'disconnectObjects', {
        input: input
    } )
        .then( function( response ) {
            if ( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else {
                eventBus.publish( 'skillsTable.plTable.reload' );
            }
        } );
};
/**
 *
 * @param {Array} partialErrors - partial errors array
 */
function showError( partialErrors ) {
    for ( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[i].errorValues[0].message );
    }
}
/**
 * get Child node attributes
 * @return {Array} array of properties to load
 */
let getChildNodeAttributes = function() {
    let attributes = [
        'bl_has_children',
        'bl_child_lines',
        'bl_item_object_name',
        'bl_item_item_id',
        'bl_occ_type',
        'bl_item_object_desc'
    ];
    let columnsFromServer = appCtxService.getCtx( 'Ssp0SkillsTableManagement' );
    if( columnsFromServer !== undefined ) { return attributes.concat( columnsFromServer ); }
    return attributes;
};
export default exports = {
    getResponseAndTotalFound,
    loadSkillsTableColumnConfig,
    unAssignSkill,
    showError,
    registerSkillInCtx,
    getChildNodeAttributes
};
