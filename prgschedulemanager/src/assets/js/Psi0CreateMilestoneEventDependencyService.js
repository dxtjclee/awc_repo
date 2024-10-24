// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0CreateMilestoneEventDependencyService
 */
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';

let _milestoneEventDependencyListener = null;
let _renderMilestoneEventDependenciesListener = null;
let _deleteMilestoneEventDependencyListener = null;

export let registerCreateMilestoneEventDependencyEvent = function() {
    if ( !_milestoneEventDependencyListener ) {
        _milestoneEventDependencyListener = eventBus.subscribe( 'createMilestoneEventDependency', function( eventData ) {
            createMilestoneEventDependencyAction( eventData.primary, eventData.secondary );
        } );
    }
    if ( !_renderMilestoneEventDependenciesListener ) {
        _renderMilestoneEventDependenciesListener = eventBus.subscribe( 'fetchMilestoneEventDependencies', function( eventData ) {
            fetchMilestoneEventDependenciesFunction( eventData );
        } );
    }
    if ( !_deleteMilestoneEventDependencyListener ) {
        _deleteMilestoneEventDependencyListener = eventBus.subscribe( 'prgSchedule.deleteMilestoneEventDependency', function( eventData ) {
            deleteMilestoneEventDependenciesFunction( eventData.dependencyDeletes );
        } );
    }
};

export let unregisterCreateMilestoneEventDependencyEvent = function() {
    if ( _milestoneEventDependencyListener ) {
        eventBus.unsubscribe( _milestoneEventDependencyListener );
        _milestoneEventDependencyListener = null;
    }
    if ( _renderMilestoneEventDependenciesListener ) {
        eventBus.unsubscribe( _renderMilestoneEventDependenciesListener );
        _renderMilestoneEventDependenciesListener = null;
    }
    if ( _deleteMilestoneEventDependencyListener ) {
        eventBus.unsubscribe( _deleteMilestoneEventDependencyListener );
        _deleteMilestoneEventDependencyListener = null;
    }
};

let createMilestoneEventDependencyAction = async function( target, source ) {
    // construct the SOA inputs
    let inputData = {
        input : [ {
            primaryObject : target,
            secondaryObject : source,
            relationType : 'Prg0EventDependencyRel',
            clientId : ''
        } ]
    };

    return await soaSvc
        .post( 'Core-2006-03-DataManagement', 'createRelations', inputData )
        .then( ( response ) => {
            let dependencyInfo = {
                secondary : source.uid,
                primary : target.uid,
                dependency : response.output[0].relation
            };
            eventBus.publish( 'prgSchedule.createMilestoneEventLink', [ dependencyInfo ] );
            // return response.output[0].relation;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );

            messagingService.showError( errMessage );
        } )
        .catch( ( error ) => {
            console.log( 'encountered exception: ' + error );
        } );
};

let fetchMilestoneEventDependenciesFunction = async function( eventData ) {
    let inputDataPrimary = {
        primaryObjects: eventData.primaryObjects,
        pref : {
            expItemRev : false,
            returnRelations : true,
            info : [ {
                relationTypeName: 'Prg0EventDependencyRel'
            } ]
        }
    };
    let inputDataSecondary = {
        secondaryObjects: eventData.primaryObjects,
        pref : {
            expItemRev : false,
            returnRelations : true,
            info : [ {
                relationTypeName: 'Prg0EventDependencyRel'
            } ]
        }
    };
    let dependencyObjects = [];
    await soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputDataPrimary )
        .then( ( response ) => {
            for( let i = 0; i < response.output.length; i++ ) {
                let output = response.output[ i ];
                let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
                if( relationshipObjects.length > 0 ) {
                    for( let index = 0; index < relationshipObjects.length; index++ ) {
                        let dependecyObj = {
                            secondary : relationshipObjects[ index ].otherSideObject.uid,
                            primary : output.inputObject.uid,
                            dependency : relationshipObjects[ index ].relation
                        };
                        dependencyObjects.push( dependecyObj );
                    }
                }
            }
        }
        );

    if( eventData.callSecondarySoa ) {
        await soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForSecondary', inputDataSecondary )
            .then( ( response ) => {
                for( let i = 0; i < response.output.length; i++ ) {
                    let output = response.output[ i ];
                    let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
                    if( relationshipObjects.length > 0 ) {
                        for( let index = 0; index < relationshipObjects.length; index++ ) {
                            let dependecyObj = {
                                secondary : output.inputObject.uid,
                                primary : relationshipObjects[ index ].otherSideObject.uid,
                                dependency : relationshipObjects[ index ].relation
                            };
                            dependencyObjects.push( dependecyObj );
                        }
                    }
                }
            }
            );
    }
    eventBus.publish( 'prgSchedule.renderMilestoneEventLinks', dependencyObjects );
};

let deleteMilestoneEventDependenciesFunction = async function( dependencyDeletes ) {
    // construct the SOA inputs
    let inputData = {
        objects : dependencyDeletes
    };

    return await soaSvc
        .post( 'Core-2006-03-DataManagement', 'deleteObjects', inputData )
        .then( ( response ) => {
            if( response.deleted[0] ) {
                eventBus.publish( 'prgSchedule.deleteMilestoneEventLink', response.deleted[0] );
            }
        } )
        .catch( ( error ) => {
            console.log( 'encountered exception: ' + error );
        } );
};
