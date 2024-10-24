// Copyright (c) 2022 Siemens

/**
 * Creates an array of uids and types for the RemoveElement soa call
 *
 * @module js/arm0RemoveElementService
 */
import appCtxSvc from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

export let performPostRemoveAction = function( data ) {
    var removedElementUIDs = exports.getRemovedElements( data );
    var removedObjects = [];

    _.forEach( removedElementUIDs, function( removedElementUID ) {
        var removedObject = appCtxSvc.ctx.rmselected.filter( function( selected ) {
            return selected.uid === removedElementUID;
        } );
        removedObjects.push.apply( removedObjects, removedObject );
    } );

    //Get underlying object and store them in clipboard
    var contextObj = removedObjects.filter( function( obj ) {
        return cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] ) !== null;
    } ).map( function( obj ) {
        return obj.props.awb0UnderlyingObject.dbValues[ 0 ];
    } );

    if( contextObj.length > 0 ) {
        ClipboardService.instance.setContents( contextObj );
    }

    //Deselect removed elements from selection model
    eventBus.publish( 'aceElementsDeSelectedEvent', {
        elementsToDeselect: removedObjects
    } );

    if( removedObjects.length > 0 ) {
        //publish elements removed from PWA
        eventBus.publish( 'ace.elementsRemoved', {
            removedObjects: removedObjects,
            viewToReact: appCtxSvc.ctx.aceActiveContext.key
        } );
    }

    //Defer Reset PWA until deselection processing is completed.
    //Reset is not needed after "Remove" action now. We are keeping this only for 4G till they align.
    if( occmgmtStateHandler.isFeatureSupported( '4GStructureFeature' ) ) {
        _.defer( function() {
            eventBus.publish( 'acePwa.reset' );
        } );
    }
};

export let getRemovedElements = function( serviceData ) {
    var rmselected = appCtxSvc.ctx.rmselected.map( function( obj ) {
        return obj.uid;
    } );
    return _.intersection( serviceData.deleted, rmselected );
};

export let processPartialErrors = function( serviceData ) {
    var name = [];
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors && appCtxSvc.ctx.rmselected.length === 1 ) {
        name.push( appCtxSvc.ctx.rmselected[ 0 ].props.awb0UnderlyingObject.uiValues[ 0 ] );
        msgObj.name += name[ 0 ];
        for( var x = 0; x < serviceData.partialErrors[ 0 ].errorValues.length; x++ ) {
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ x ].message;
            msgObj.msg += '<BR/>';
        }
        msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ 0 ].level ] );
    }

    return msgObj;
};

export default exports = {
    performPostRemoveAction,
    getRemovedElements,
    processPartialErrors
};
