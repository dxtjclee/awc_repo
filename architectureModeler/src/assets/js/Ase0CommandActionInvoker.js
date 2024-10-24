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
 * @module js/Ase0CommandActionInvoker
 */
import diagramSaveService from 'js/Ase0ArchitectureDiagramSaveService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

export let invokeCommandAction = function( userAction, inputEventData, graphState, occContext ) {
    var eventData = {
        userAction: userAction
    };
    if( inputEventData && !_.isEmpty( inputEventData ) ) {
        eventData = inputEventData;
    }
    switch ( userAction ) {
        // To do add case for user action if additional data needs to be passed in event
        case 'ClearDiagram':
            if( diagramSaveService.isWorkingContextTypeDiagram( occContext ) ) {
                diagramSaveService.setHasPendingChangeInDiagram( true, graphState );
            }
            eventBus.publish( 'AMManageDiagramEvent', eventData );
            break;

        case 'GetAllInterfaces':
        case 'AssociateIDsToIOI':
            eventBus.publish( 'AMManageDiagramEvent', eventData );
            break;
        case 'fitDiagram':
            eventBus.publish( 'AMGraphFitEvent', eventData );
            return;
        case 'fitSelectedDiagram':
            eventBus.publish( 'AMGraphFitSelectedEvent', eventData );
            break;
        case 'selectedOnlyInDiagram':
            eventBus.publish( 'AMGraphSelectedOnlyEvent', eventData );
            break;
        case 'selectedOffInDiagram':
            eventBus.publish( 'AMGraphSelectedOffEvent', eventData );
            break;
        case 'deleteTraceLink':
            eventBus.publish( 'architecture.RemoveTrackLinkEvent' );
            break;
        case 'alignTop':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'TOP' } );
            break;
        case 'alignBottom':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'BOTTOM' } );
            break;
        case 'alignMiddle':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'MIDDLE' } );
            break;
        case 'alignLeft':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'LEFT' } );
            break;
        case 'alignRight':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'RIGHT' } );
            break;
        case 'alignCenter':
            eventBus.publish( 'archModeler.AlignmentEvent', { userAction: 'CENTER' } );
            break;
        case 'reconnectConnection':
            eventBus.publish( 'AMGraphEvent.reconnect' );
            break;
        default:
            eventBus.publish( userAction, eventData );
            break;
    }
};

const exports = {
    invokeCommandAction
};
export default exports;
