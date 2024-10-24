// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/Psi0CreatePanelService
 */
import dateTimeSvc from 'js/dateTimeService';
import uwPropertyService from 'js/uwPropertyService';
import addObjectUtils from 'js/addObjectUtils';
import xrtUtilities from 'js/xrtUtilities';
import _ from 'lodash';

var exports = {};

var setDateValueForProp = function( vmoProp, dateVal ) {
    uwPropertyService.setValue( vmoProp, dateVal.getTime() );
    vmoProp.dateApi.dateObject = dateVal;
    vmoProp.dateApi.dateValue = dateTimeSvc.formatDate( dateVal, dateTimeSvc
        .getSessionDateFormat() );
    vmoProp.dateApi.timeValue = dateTimeSvc.formatTime( dateVal, dateTimeSvc
        .getSessionDateFormat() );
};

var selectDate = function( revision__psi0DueDate, psi0TargetDate, psi0DueDate ) {
    let dateProp;
    if( revision__psi0DueDate ) {
        dateProp = revision__psi0DueDate;
    } else if( psi0TargetDate ) {
        dateProp = psi0TargetDate;
    } else if( psi0DueDate ) {
        dateProp = psi0DueDate;
    }
    return dateProp;
};

/**
 * Populates the default date property in the panel for PDR and RIO objects
 *
 * @param {Object} data is used to fetch the required property on panel which is to be set as default value
 * @param {Object} ctx is used to fetch the event information i.e. sublocation and planned date
 */
export let populateDefaultValuesFromEvent = function( revision__psi0DueDate, psi0TargetDate, psi0DueDate, selectionData, createType, editHandler ) {
    let event;
    let dateProp;
    let updatedProps = [];
    if( selectionData.selected[0].modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
        event = selectionData.selected[0];
    } else if( selectionData.pselected.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
        event = selectionData.pselected; //while creating Program relation
    }
    if( event && event.props.prg0PlannedDate ) {
        dateProp = selectDate( revision__psi0DueDate, psi0TargetDate, psi0DueDate );
        if( createType && !dateProp ) {
            let editableProps = addObjectUtils.getObjCreateEditableProperties( createType, null, null, editHandler );
            _.forEach( editableProps, function( prop ) {
                if( prop && ( prop.propertyName === 'psi0TargetDate' || prop.propertyName === 'psi0DueDate' ||
                        prop.propertyName === 'REF(revision,Psi0PrgDelRevisionCreI).psi0DueDate' ) ) {
                    dateProp = prop;
                }
            } );
        }
        if( dateProp ) {
            let dueDate = new Date( event.props.prg0PlannedDate.dbValues[ 0 ] );
            setDateValueForProp( dateProp, dueDate );
            updatedProps.push( dateProp );
        }
    }
    if( updatedProps.length > 0 ) {
        xrtUtilities.updateObjectsInDataSource( updatedProps, 'CREATE', createType, editHandler );
    }
};

exports = {
    populateDefaultValuesFromEvent
};
export default exports;
