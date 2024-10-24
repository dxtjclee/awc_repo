//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/Psi0RelateScheduleService
 */
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

/**
 * createRelations SOA input data.
 *
 * @param {object} data the view model data object
 * @param {object} valid schedules which are not templates or unpublished.
 * @param {string} relation type.
 */
export let getCreateInput = function( validSchedules, targetObject ) {
    var input = [];
    var objRelation = null;

    if ( targetObject && targetObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
        objRelation = 'Psi0EventScheduleRelation';
    } else {
        objRelation = 'Psi0PlanSchedule';
    }
    for ( var secondObj in validSchedules ) {
        if ( validSchedules.hasOwnProperty( secondObj ) ) {
            var inputData = {
                primaryObject: targetObject,
                secondaryObject: validSchedules[secondObj],
                relationType: objRelation,
                clientId: '',
                userData: {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                }
            };
            input.push( inputData );
        }
    }
    return input;
};

/**
 * Get projects
 *
 * @param {response} response of getProperties SOA call
 */
export let getProps = function( response, addPanelSourceObjects ) {
    var schedules = null;
    var IsNotValidSchedule = true;
    var validSchedules = [];
    var invalidSchedules = [];
    var selectedUids = [];

    for ( var sourceObj in addPanelSourceObjects ) {
        selectedUids.push( addPanelSourceObjects[sourceObj].uid ); // fill selected schedules UID's from panel in selectedUids array.
    }
    for ( var object in response.modelObjects ) {
        let scheduleObj = cdm.getObject( object );
        // only add selected schedule in valid/invalid schedules array
        if ( scheduleObj && cmm.isInstanceOf( 'Schedule', scheduleObj.modelType ) && selectedUids.includes( scheduleObj.uid ) ) {
            IsNotValidSchedule = scheduleObj.props.is_template?.dbValues[0] === '1' || scheduleObj.props.published?.dbValues[0] === '0';
            if ( !IsNotValidSchedule ) {
                validSchedules.push( scheduleObj );
            } else {
                invalidSchedules.push( scheduleObj );
            }
        }
    }
    schedules = {
        validSchedules: validSchedules,
        invalidSchedules: invalidSchedules
    };
    return schedules;
};

/**
 * Get Error Message.
 *
 * @param {object} data the view model data object
 * @param {array} The array of schedules.
 */
export let getErrorMessage = function( data, schedules ) {
    _.forEach( schedules, function() {
        throw 'invalidScheduleErrorMsg';
    } );
};

/**
 * Get Schedules.
 *
 * @param {object} data the view model data object
 */
export let getSchedules = function( sourceObjects ) {
    var input = [];
    var inputData;
    for ( var objects in sourceObjects ) {
        if ( sourceObjects.hasOwnProperty( objects ) ) {
            inputData = sourceObjects[objects];
            input.push( inputData );
        }
    }
    return input;
};

export default exports = {
    getCreateInput,
    getProps,
    getErrorMessage,
    getSchedules
};
