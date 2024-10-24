// Copyright (c) 2023 Siemens

/**
 * Create or assign Notice functions
 *
 * @module js/ssp0AddNoticeOnActivityService
 */
import _ from 'lodash';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Get the List of Notice
 * @param {Object} data data
 * @return {Object} List of Notice
 */
export let noticeList = function( data ) {
    let noticeList = [];
    if( data.searchResults ) {
        let noticeNames = data.searchResults;
        for( let i = 0; i < noticeNames.length; i++ ) {
            let dbValue = noticeNames[ i ].props.type_name.dbValues[ 0 ];
            let uiValue = noticeNames[ i ].props.type_name.uiValues[ 0 ];

            noticeList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
        if ( noticeList.length > 0 ) {
            eventBus.publish( 'ssp0AddActivityNotices.updateCurrentNotice', { currentNoticeType: noticeList[0] } );
        }
    }

    return noticeList;
};

/**
 * create relation input
 * @param {Object} data data
 * @return {Object} input for create relation
 */
export let createRelationInput = ( data ) => {
    let input = [];
    let secondaryObject;
    if( data.selectedTab.tabKey === 'newNotice' ) {
        secondaryObject = data.createdObject;
        input.push( {
            primaryObject: appCtxSvc.getCtx( 'selected' ),
            secondaryObject: secondaryObject,
            relationType: 'SSP0HasWarning',
            clientId: ''
        } );
    } else {
        let secondaryObjects = data.dataProviders.noticesListProvider.selectedObjects;
        for( let secondaryObject of secondaryObjects ) {
            input.push( {
                primaryObject: appCtxSvc.getCtx( 'selected' ),
                secondaryObject: secondaryObject,
                relationType: 'SSP0HasWarning',
                clientId: ''
            } );
        }
    }
    return input;
};
/**
 * Clone the type of Selected Object into the data
 * @param {Object} data data
 * @param {Object} fields fields

 * @return {Object} an object for given context
 */
export let changeAction = function( data, fields ) {
    let cloneData = _.clone( data );
    if( cloneData.totalFound === 0 ) {
        cloneData.selectedType.dbValue = servicePlannerConstants.TYPE_NOTICE;
    } else {
        cloneData.selectedType.dbValue = data.currentNotice.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }
    return cloneData;
};
export let getElementsToAdd = ( data ) => {
    var object = [];
    object = data.output[ 0 ].objects;
    var index = 0;
    for( var i = 0; i < object.length; i++ ) {
        if( object[ i ].type === data.selectedType.dbValue ) {
            index = i;
            break;
        }
    }
    var array = [];
    array[ 0 ] = {
        uid: object[ index ].uid,
        type: object[ index ].type
    };
    return array;
};

export let getCreateInput = function( data ) {
    var creInputMap = {};
    creInputMap[ '' ] = {
        boName: data.selectedType.dbValue,
        propertyNameValues: {},
        compoundCreateInput: {}
    };

    return [ {
        clientId: 'createObject',
        createData: _.get( creInputMap, '' ),
        dataToBeRelated: {},
        workflowData: {}
    } ];
};

export default exports = {
    getElementsToAdd,
    getCreateInput,
    noticeList,
    changeAction,
    createRelationInput
};
