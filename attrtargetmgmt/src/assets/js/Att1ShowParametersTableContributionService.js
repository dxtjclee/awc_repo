// Copyright (c) 2022 Siemens

/**
 * Service for handling contributions to Architecture tab
 *
 * @module js/Att1ShowParametersTableContributionService
 */
import AwPromiseService from 'js/awPromiseService';
import conditionService from 'js/conditionService';
import contributionService from 'js/contribution.service';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

/**
 * Get contributing parameters table
 *
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let getContributedParametersTable = function( commandContext, parametersTableCtx ) {
    var deferred = AwPromiseService.instance.defer();
    var paramTableKey = commandContext.paramTableKey === undefined ? 'att1ShowParametersTableKey' : commandContext.paramTableKey;
    //Get all of the command providers
    contributionService.loadContributions( paramTableKey ).then( function( providers ) {
        if( providers && providers.length > 0 ) {
            var parameterTables = providers.map( function( table, index ) {
                return {
                    clientScopeURI: table.clientScopeURI,
                    condition: table.condition,
                    dataProvider: table.dataProvider === undefined ? 'Att1ShowParametersProvider' : table.dataProvider,
                    disabledCommands: table.disabledCommands,
                    enableSync: table.enableSync,
                    id: table.id,
                    index: index,
                    listenToPrimarySelectionEvent: table.listenToPrimarySelectionEvent,
                    options: table.options,
                    panelId:  commandContext.reusable ? 'Att1ShowReusableParametersTable' : 'Att1ShowParametersTable',
                    parentObjects: table.parentObjects,
                    priority: table.priority,
                    usage: table.usage,
                    separator: table.separator === undefined ? '^$~' : table.separator,
                    additionalSearchCriteria: table.searchCriteria,
                    showContextMenu: table.showContextMenu,
                    containerHeight: table.containerHeight === undefined ? 450 : table.containerHeight,
                    editContext: table.editContext,
                    requestId: table.requestId,
                    createEmptyMeasurementFunc : table.createEmptyMeasurement,
                    policy: table.policy
                };
            } );

            if( parameterTables ) {
                var cmdCtx = { ...commandContext, parametersTable: parametersTableCtx };
                var activeTable = _getActiveParametersTable( parameterTables, cmdCtx );
                if( activeTable ) {
                    if( activeTable.disabledCommands ) {
                        parametersTableCtx.disabledCommands = parametersTableCtx.disabledCommands === undefined ? {} : parametersTableCtx.disabledCommands;
                        _.forEach( activeTable.disabledCommands, function( command ) {
                            var disabledCmd = 'parametersTable.disabledCommands.' + command;
                            parametersTableCtx.disabledCommands[ command ] = '';
                        } );
                    }
                    if( activeTable.options ) {
                        parametersTableCtx.options = parametersTableCtx.options === undefined ? {} : parametersTableCtx.options;
                        for( var key in activeTable.options ) {
                            var option = 'parametersTable.options.' + key;
                            if( activeTable.options[ key ] === true || activeTable.options[ key ] === 'true' ) {
                                parametersTableCtx.options[ key ] = true;
                            } else {
                                parametersTableCtx.options[ key ] = false;
                            }
                        }
                    }
                    if( activeTable.parentObjects ) {
                        var parentObjects;

                        if( typeof activeTable.parentObjects === 'function' ) {
                            parentObjects = activeTable.parentObjects( commandContext );
                        } else {
                            parentObjects = _.get( { commandContext }, activeTable.parentObjects, undefined );
                        }
                        if( parentObjects ) {
                            parametersTableCtx.parentObjects = parentObjects;
                        }
                    }

                    // Allow the parameters table contribution to configure whether or not create the empty measurement when create a new parameter.
                    if( activeTable.createEmptyMeasurementFunc && typeof activeTable.createEmptyMeasurementFunc === 'function' ) {
                        parametersTableCtx.createEmptyMeasurementFunc = activeTable.createEmptyMeasurementFunc;
                    }
                    if( activeTable.listenToPrimarySelectionEvent ) {
                        parametersTableCtx.listenToPrimarySelectionEvent = activeTable.listenToPrimarySelectionEvent;
                    }
                    if( activeTable.enableSync ) {
                        parametersTableCtx.enableSync = activeTable.enableSync;
                    }
                    parametersTableCtx.panelId = activeTable.panelId;
                    parametersTableCtx.clientScopeURI = activeTable.clientScopeURI;
                    parametersTableCtx.usage = activeTable.usage;
                    parametersTableCtx.separator = _.get( commandContext, activeTable.separator, '^$~' );
                    parametersTableCtx.dataProvider = activeTable.dataProvider;
                    parametersTableCtx.containerHeight = activeTable.containerHeight;
                    parametersTableCtx.showContextMenu = activeTable.showContextMenu !== false;
                    parametersTableCtx.policy = activeTable.policy;

                    if( activeTable.additionalSearchCriteria ) {
                        if( activeTable.options.compareParameters && activeTable.additionalSearchCriteria.comparisonElements ) {
                            var comparisonElements = _.get( commandContext, activeTable.additionalSearchCriteria.comparisonElements, undefined );
                            if( comparisonElements ) {
                                parametersTableCtx.searchCriteria = comparisonElements;
                            }
                        } else {
                            parametersTableCtx.searchCriteria = activeTable.additionalSearchCriteria;
                        }
                    }
                    // For XRT based parameters table edit context should not be defined
                    // For Sync the default should be NONE however application team can define custom editContext for their tables.
                    if( activeTable.editContext ) {
                        parametersTableCtx.editContext = activeTable.editContext;
                    }
                    if( activeTable.requestId ) {
                        parametersTableCtx.requestId = _.get( commandContext, activeTable.requestId, undefined );
                    }else{
                        parametersTableCtx.requestId = _getRequestId();
                    }

                    //set paramTableKey in parameterTable ctx to identify each table
                    parametersTableCtx.paramTableKey = paramTableKey;
                }
                deferred.resolve();
            }
        } else {
            deferred.resolve( null );
        }
    } );

    return deferred.promise;
};

/**
 * Get request id
 */
 var _getRequestId = function() {
    return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
        Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
};

/**
 * Evaluate conditions for all given tables and return the one with valid condition and highest priority
 * @param {Array} panels all contributing panels
 * @returns {Object} active split panel
 */
function _getActiveParametersTable( tables, commandContext ) {
    var activeTable = null;
    if( tables ) {
        _.forEach( tables, function( table ) {
            if( table.condition ) {
                if( typeof table.condition === 'string' ) {
                    var isConditionTrue = conditionService.evaluateCondition( {
                        ctx: appCtxSvc.ctx,
                        commandContext: commandContext
                    }, table.condition );
                    if( isConditionTrue ) {
                        if( !activeTable || table.priority > activeTable.priority ) {
                            activeTable = table;
                        }
                    }
                } else if( typeof table.condition === 'function' ) {
                    var isConditionTrue = table.condition();
                    if( isConditionTrue ) {
                        if( !activeTable || table.priority > activeTable.priority ) {
                            activeTable = table;
                        }
                    }
                }
            }
        } );
    }
    return activeTable;
}

/**
 * This factory creates a service and returns exports
 *
 * @member Att1ShowParametersTableContributionService
 */

export default exports = {
    getContributedParametersTable
};
