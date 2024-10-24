// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0AddResponsibleUserService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
var exports = {};

/**
 * prepare the input for set properties SOA call to add the responsible User
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let addResponsibleUser = function( selectedUsers, ctx ) {
    var inputData = [];

    var selected = ctx.mselected;

    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );
        infoObj.timestamp = '';

        var temp = {};
        if( selectedTask.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 || selectedTask.modelType.typeHierarchyArray.indexOf( 'Psi0ChecklistQuestion' ) > -1 || selectedTask.modelType.typeHierarchyArray.indexOf( 'Apm0QualityChecklist' ) > -1 ) {
            temp.name = 'psi0ResponsibleUser';
        } else {
            temp.name = 'psi0ResponsibleUsr';
        }
        temp.values = [ selectedUsers[ 0 ].props.user.dbValue ];

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};


/**
 * Utility method to get the initial selection Uid string.
 *
 * @param {String} selectedUid Initial selection Uid
 * @returns {String} Initial selection Uid string
 */
export const cacheSelection = selectedUid => {
    return selectedUid;
};

/**
 * Update the people picker search criteria based on selected target object uid to show people based
 * on project.
 *
 * @param {Object} userPanelContext User panel state context object where criteria need to be updated
 * @param {Object} criteriaObject Contains the keys that need to be updated in search criteria
 */
export let updateUserPanelSearchStateCriteria = function( userPanelContext, criteriaObject ) {
    const userPanelState = { ...userPanelContext };
    var criteria = userPanelState.criteria;
    if( userPanelContext && criteriaObject ) {
        for( const key of Object.keys( criteriaObject ) ) {
            if( criteriaObject[ key ] ) {
                criteria[ key ] = criteriaObject[ key ];
            }
        }
    }
    userPanelState.criteria = criteria;
    var mselected = appCtxSvc.ctx.mselected;
    let selectedObj = mselected[0];

    //update the preset filter with projects(TC_project) of deliverable
    if( selectedObj.props.project_list ) {
        var project_list = [];
        project_list = getProjects( mselected );

        //if project list is empty remove the key
        if( !project_list || project_list.length === 0 ) {
            delete userPanelState.presetFilters[ 'GroupMember.project_list' ];
        } else{
            var projectIds = [];
            for ( var projectIndex = 0; projectIndex < project_list.length; projectIndex++ ) {
                if( project_list[projectIndex].includes( '-' ) ) {
                    var modProjectName = project_list[projectIndex].split( '-' );
                    projectIds.push( modProjectName[0] );
                }else{
                    projectIds.push( project_list[projectIndex] );
                }
            }
            userPanelState.presetFilters['GroupMember.project_list'] = projectIds;
        }
    } else{
        delete userPanelState.presetFilters['GroupMember.project_list'];
    }

    //update preset filters with group and role values from assigned resource pool
    if ( selectedObj.props.psi0ResourceAssignment ) {
        var sameResourcePool = true;
        //check if all selected deliverables have same resource pool
        for ( var i = 1; i < mselected.length; i++ ) {
            if ( mselected[ i - 1 ].props.psi0ResourceAssignment.dbValues[0] !== mselected[i].props.psi0ResourceAssignment.dbValues[0] ) {
                sameResourcePool = false;
                break;
            }
        }
        if ( sameResourcePool === true && selectedObj.props.psi0ResourceAssignment.dbValues.length > 0 ) {
            const GRValue = selectedObj.props.psi0ResourceAssignment.displayValues[0].split( '/' );
            userPanelState.presetFilters['GroupMember.group'][0] = GRValue[0];
            userPanelState.presetFilters['GroupMember.role'][0] = GRValue[1];
        }else{
            //if group and role values are not same delete the preset filters to load users
            delete userPanelState.presetFilters['GroupMember.group'];
            delete userPanelState.presetFilters['GroupMember.role'];
        }
    }else{
        //if prop does not exist delete the preset filters to load users (LCS-803459)
        delete userPanelState.presetFilters['GroupMember.group'];
        delete userPanelState.presetFilters['GroupMember.role'];
    }
    return {
        userPanelState : userPanelState,
        isDataInit : true
    };
};


/**
  * @param {mselected} mselected - The selected objects in ctx.
  * @returns {Array} common project list
  */
function getProjects( mselected ) {
    var project_list = [];
    if( mselected[0].props.project_list.displayValues.length > 0 ) {
        project_list = mselected[0].props.project_list.displayValues;
    }
    for ( var i = 1; i < mselected.length; i++ ) {
        if( mselected[i].props && mselected[i].props.project_list && mselected[i].props.project_list.displayValues.length > 1 ) {
            var filteredArray = mselected[i].props.project_list.displayValues.filter( function( n ) {
                return project_list.indexOf( n ) !== -1;
            } );
            project_list = filteredArray;
        }
    }
    return project_list;
}
export default exports = {
    addResponsibleUser,
    cacheSelection,
    updateUserPanelSearchStateCriteria
};
