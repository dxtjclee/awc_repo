// Copyright (c) 2023 Siemens

/**
 * @module js/Psi0MoveObjectsOnGanttAndTimelineService
 */
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import messagingService from 'js/messagingService';
import _localeSvc from 'js/localeService';

let _moveMilestonesListener = null;
let _prgEventDraggedListener = null;
let _unsubscribePsi0Events = null;


export let invokePsi0Module = function() {
    //Registering new CTX to check psi0 installation and TC143 version check
    let tcSessionData = appCtxSvc.getCtx( 'tcSessionData' );
    if( tcSessionData.tcMajorVersion > 14 || tcSessionData.tcMajorVersion === 14 && tcSessionData.tcMinorVersion >= 3 ) {
        let isTCVersion143 = appCtxSvc.getCtx( 'isValidToCallMoveMilestoneSOA' );
        if( isTCVersion143 ) {
            appCtxSvc.updateCtx( 'isValidToCallMoveMilestoneSOA', true );
        } else{
            appCtxSvc.registerCtx( 'isValidToCallMoveMilestoneSOA', true );
        }
    }
    if ( !_moveMilestonesListener ) {
        _moveMilestonesListener = eventBus.subscribe( 'prgSchedule.milestoneDragged', function( eventData ) {
            checkEventDependencyForMilestone( eventData );
        } );
    }
    if( !_prgEventDraggedListener ) {
        _prgEventDraggedListener = eventBus.subscribe( 'prgSchedule.prgEventDragged', function( eventData ) {
            checkEventDependencyForEvent( eventData );
        } );
    }
    if( !_unsubscribePsi0Events ) {
        _unsubscribePsi0Events = eventBus.subscribe( 'prgSchedule.unsubscribePsi0Events', function( ) {
            unsubscribePsi0Events( );
        } );
    }
};

let unsubscribePsi0Events = function() {
    if ( _moveMilestonesListener ) {
        eventBus.unsubscribe( _moveMilestonesListener );
        _moveMilestonesListener = null;
    }
    if ( _prgEventDraggedListener ) {
        eventBus.unsubscribe( _prgEventDraggedListener );
        _prgEventDraggedListener = null;
    }
    if ( _unsubscribePsi0Events ) {
        eventBus.unsubscribe( _unsubscribePsi0Events );
        _unsubscribePsi0Events = null;
    }
};

let displayConfirmationMessageForEventDragged = function( eventUpdateInfo ) {
    let deferred = AwPromiseService.instance.defer();
    let buttonArray = [];
    let localTextBundle = _localeSvc.getLoadedText( 'PrgScheduleManagerMessages' );
    buttonArray.push( createButton( localTextBundle.CancelText, function( $noty ) {
        callMoveEventsSOA( eventUpdateInfo, false );
        $noty.close();
        deferred.resolve();
    } ) );

    buttonArray.push( createButton( localTextBundle.moveText, function( $noty ) {
        callMoveEventsSOA( eventUpdateInfo, true );
        $noty.close();
        deferred.resolve();
    } ) );

    let confirmationMessage = localTextBundle.confirmMoveSecondaryObjects;
    messagingService.showWarning( confirmationMessage.replace( '{0}', eventUpdateInfo.object.props.object_name.dbValues[0] )
        .replace( '{1}', eventUpdateInfo.formattedDate )
        .replace( '{2}', eventUpdateInfo.object.props.object_name.dbValues[0] ), buttonArray );
    return deferred.promise;
};

let displayConfirmationMessageForMoveMilestones = function( milestonesUpdateInfo ) {
    let deferred = AwPromiseService.instance.defer();
    let buttonArray = [];
    let localTextBundle = _localeSvc.getLoadedText( 'PrgScheduleManagerMessages' );
    buttonArray.push( createButton( localTextBundle.CancelText, function( $noty ) {
        $noty.close();
        callMoveMilestonesSOA( milestonesUpdateInfo, false );
        deferred.resolve();
    } ) );

    buttonArray.push( createButton( localTextBundle.moveText, function( $noty ) {
        $noty.close();
        callMoveMilestonesSOA( milestonesUpdateInfo, true );
        deferred.resolve();
    } ) );

    let confirmationMessage = localTextBundle.confirmMoveSecondaryObjects;
    messagingService.showWarning( confirmationMessage.replace( '{0}', milestonesUpdateInfo.object.props.object_name.dbValues[0] )
        .replace( '{1}', milestonesUpdateInfo.formattedDate )
        .replace( '{2}', milestonesUpdateInfo.object.props.object_name.dbValues[0] ), buttonArray );
    return deferred.promise;
};

let createButton = function( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
};

let checkEventDependencyForEvent = async function( eventUpdateInfo ) {
    let isEventDependency = false;
    if( eventUpdateInfo ) {
        let inputDataPrimary = {
            primaryObjects: [ eventUpdateInfo.object ],
            pref : {
                expItemRev : false,
                returnRelations : true,
                info : [ {
                    relationTypeName: 'Prg0EventDependencyRel'
                } ]
            }
        };
        await soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputDataPrimary )
            .then( ( response ) => {
                for( let i = 0; i < response.output.length; i++ ) {
                    let output = response.output[ i ];
                    let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
                    if( relationshipObjects && relationshipObjects.length > 0 ) {
                        isEventDependency = true;
                        break;
                    }
                }
            }
            );
    }

    if( isEventDependency ) {
        displayConfirmationMessageForEventDragged( eventUpdateInfo );
    } else{
        callMoveEventsSOA( eventUpdateInfo, false );
    }
};

let checkEventDependencyForMilestone = async function( milestoneUpdateInfo ) {
    let isEventDependency = false;
    if( milestoneUpdateInfo && milestoneUpdateInfo.updates.length > 0 ) {
        let inputDataPrimary = {
            primaryObjects: [ milestoneUpdateInfo.updates[0].object ],
            pref : {
                expItemRev : false,
                returnRelations : true,
                info : [ {
                    relationTypeName: 'Prg0EventDependencyRel'
                } ]
            }
        };
        await soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputDataPrimary )
            .then( ( response ) => {
                for( let i = 0; i < response.output.length; i++ ) {
                    let output = response.output[ i ];
                    let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
                    if( relationshipObjects && relationshipObjects.length > 0 ) {
                        isEventDependency = true;
                        break;
                    }
                }
            }
            );
    }

    if( isEventDependency ) {
        displayConfirmationMessageForMoveMilestones( milestoneUpdateInfo.updates[0] );
    } else{
        callMoveMilestonesSOA( milestoneUpdateInfo.updates[0], false );
    }
};

let callMoveMilestonesSOA = async function( milestonesUpdateInfo, updateSecondaryObjects ) {
    let inputData = {};
    let moveMilestonesInput = [];
    let updateObject = {
        scheduleTaskObject : {
            type: milestonesUpdateInfo.object.type,
            uid: milestonesUpdateInfo.object.uid
        },
        newDate : milestonesUpdateInfo.updates[0].attrValue,
        updateSecondaryObjects: updateSecondaryObjects
    };
    moveMilestonesInput.push( updateObject );
    inputData.moveMilestonesInput = moveMilestonesInput;
    inputData.runInBackground = false;
    try {
        await soaSvc.post( 'PPSMInterfaceAw-2023-06-PPSMInterface', 'moveMilestones', inputData );
    } catch ( error ) {
        showErrorMessage( error );
        eventBus.publish( 'cdm.updated', { updatedObjects: [ milestonesUpdateInfo.object ] } );
    }
};

let callMoveEventsSOA = async function( eventUpdateInfo, updateSecondaryEvents ) {
    let inputData =  {
        events: [ eventUpdateInfo.object ],
        newEventDate: eventUpdateInfo.newPlannedDate,
        updateSecondaryEvents: updateSecondaryEvents,
        runInBackground: false

    };
    try {
        await soaSvc.post( 'ProgramInfra-2021-12-ProgramManagement', 'moveEvents', inputData );
    } catch ( error ) {
        showErrorMessage( error );
        eventBus.publish( 'cdm.updated', { updatedObjects: [ eventUpdateInfo.object ] } );
    }
};

let showErrorMessage = function( error ) {
    let errMessage = messagingService.getSOAErrorMessage( error );
    messagingService.showError( errMessage );
};
