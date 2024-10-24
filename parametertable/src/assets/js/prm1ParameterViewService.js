// Copyright (c) 2022 Siemens

/**
 * @module js/prm1ParameterViewService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import LocationNavigationService from 'js/locationNavigation.service';
import navigationSvc from 'js/navigationService';
import cmm from 'soa/kernel/clientMetaModel';
import selectionService from 'js/selection.service';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import compareService from 'js/Att1CompareParametersService';
import tcVmoService from 'js/tcViewModelObjectService';
import localeService from 'js/localeService';
import messageService from 'js/messagingService';
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Method to refresh the compare parameter table
 */
export let refreshCompareTable = function( paramCompareViewContext ) {
    var comparisionElements = compareService.getComparisonElements( getSeparator( paramCompareViewContext ) );
    return {
        searchCriteria: {
            comparisionElements: comparisionElements
        }
    };
};

/**
 * Method to get Compare type
 * @return {String} Compare type i.e. ProjectParamComparison or ProductParamComparison
 */
function _getCompareType() {
    let defer = AwPromiseService.instance.defer();
    var selectedUid = [];
    let params = AwStateService.instance.params;

    if ( params.uid ) {
        selectedUid.push( params.uid );
        dmService.loadObjects( selectedUid ).then( function() {
            // var propertyName = 'object_name';
            var compareType = 'ProductParamComparison';
            var selectedParent = cdm.getObject( selectedUid[0] );
            if ( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
                compareType = 'ProjectParamComparison';
            }
            defer.resolve( compareType );
        } );
    }
    return defer.promise;
}

/**
 * Method to get title
 * @return {String} title i.e. ProjectParamComparison or ProductParamComparison
 */
function _getTitle() {
    let defer = AwPromiseService.instance.defer();
    localeService.getLocalizedText( 'prm1ParameterTableMessages', 'comparisonParamTitle' ).then( function( result ) {
        defer.resolve( result );
    } );
    return defer.promise;
}

/**
 * Method to Header string
 * @return {String} title i.e. ProjectParamComparison or ProductParamComparison
 */
function _getHeaderString( propertyName ) {
    let defer = AwPromiseService.instance.defer();
    getSelectedObjectsHeaderString( propertyName ).then( function( headerString ) {
        defer.resolve( headerString );
    } ).catch( function( error ) {
        defer.reject( error );
    } );
    return defer.promise;
}
export let loadCompareData = function() {
    let defer = AwPromiseService.instance.defer();
    var paramCompareViewContextCtx = {};

    _getCompareType().then( function( compareType ) {
        paramCompareViewContextCtx.compareType =  compareType;
        return compareType === 'ProductParamComparison' ? 'awb0ArchetypeName' : 'object_name';
    } )
        .then( function( propertyName ) {
            return _getHeaderString( propertyName );
        } )
        .then( function( headerString ) {
            paramCompareViewContextCtx.headerWithObjectNames =  headerString;
            return _getTitle();
        } )
        .then( function( result ) {
            paramCompareViewContextCtx.defaultTitle = result;
            defer.resolve( paramCompareViewContextCtx );
        } ).catch( function( error ) {
            defer.reject( error );
        } );

    return defer.promise;
};


export let updateHeaderProperties = function( data ) {
    let defer = AwPromiseService.instance.defer();

    _getCompareType().then( function( compareType ) {
        if( compareType === 'ProductParamComparison' ) {
            updateHeaderPropertiesForProduct(  data ).then( function( result ) {
                defer.resolve( result );
            } ).catch( function( error ) {
                defer.reject( error );
            } );
        } else{
            updateHeaderPropertiesForProject(  data ).then( function( result ) {
                defer.resolve( result );
            } ).catch( function( error ) {
                defer.reject( error );
            } );
        }
    } ).catch( function( error ) {
        defer.reject( error );
    } );
    return defer.promise;
};

export let handlePartialError = function( data ) {
    var serviceData = data.ServiceData;
    if( serviceData && serviceData.partialErrors && serviceData.partialErrors[0] &&
        serviceData.partialErrors[0].errorValues[0] ) {
        var errorMsg = data.ServiceData.partialErrors[0].errorValues[0].message;
        messageService.showError( errorMsg );
    }
};
/**
 * Method to update the header proeprties in product
 * @param {Object} data the view Model data object
 */
function updateHeaderPropertiesForProduct( data ) {
    var deferred = AwPromiseService.instance.defer();

    const taskBarRevisionRule = _.clone( data.taskBarRevisionRule );
    const taskBarVariantRule = _.clone( data.taskBarVariantRule );
    const taskBarEffDate = _.clone( data.taskBarEffDate );
    const taskBarUnits = _.clone( data.taskBarUnits );

    let params = AwStateService.instance.params;
    var productContext = params.productContextUids;
    var objsToLoad = [ { uid: productContext } ];
    var propsToLoad = [ 'awb0CurrentRevRule', 'awb0CurrentVariantRule', 'awb0ClosureRule', 'awb0EffDate', 'awb0EffectivityGroups', 'awb0EffUnitNo' ];
    tcVmoService.getViewModelProperties( objsToLoad, propsToLoad ).then( function( response ) {
        var pContext = cdm.getObject( productContext );
        if( pContext.props ) {
            var revision = pContext.props.awb0CurrentRevRule.uiValues;
            var awb0CurrentVariantRule = pContext.props.awb0CurrentVariantRule.uiValues;
            var effDateLocal = pContext.props.awb0EffDate.uiValues;
            var effGroup = pContext.props.awb0EffectivityGroups.uiValues;
            var effUnitNo = pContext.props.awb0EffUnitNo.uiValues;
            if( revision && revision.length > 0 && revision[ 0 ].length > 0 ) {
                taskBarRevisionRule.uiValue = revision[ 0 ];
            }
            if( awb0CurrentVariantRule && awb0CurrentVariantRule.length > 0 && awb0CurrentVariantRule[ 0 ].length > 0 ) {
                taskBarVariantRule.uiValue = awb0CurrentVariantRule[ 0 ];
            }

            if( effDateLocal && effDateLocal.length > 0 && effDateLocal[ 0 ].length > 0 ) {
                taskBarEffDate.uiValue = effDateLocal[ 0 ];
            }
            if( effUnitNo && effUnitNo.length > 0 && effUnitNo[ 0 ].length > 0 ) {
                taskBarUnits.uiValue = effUnitNo[ 0 ];
            } else if( effGroup && effGroup.length > 0 && effGroup[ 0 ].length > 0 ) {
                taskBarUnits.uiValue = effGroup[ 0 ];
            }
        }
        deferred.resolve(  {
            taskBarRevisionRule:taskBarRevisionRule,
            taskBarVariantRule:taskBarVariantRule,
            taskBarEffDate:taskBarEffDate,
            taskBarUnits:taskBarUnits,
            compareType: 'ProductParamComparison'
        } );
    } );
    return deferred.promise;
}

/**
 * Methos to update the header as paer the selected objects
 * @param {Object} ctx the contect object
 * @param {String} property the property name to fetch
 */
function getSelectedObjectsHeaderString( property ) {
    let defer = AwPromiseService.instance.defer();
    let params = AwStateService.instance.params;
    var selectedUids = params.sel_uids;
    if( selectedUids ) {
        var headerString = '';
        selectedUids = selectedUids.split( getSeparator() ).map( function( obj ) {
            return { uid: obj };
        } );
        var propsToLoad = [ property ];
        tcVmoService.getViewModelProperties( selectedUids, propsToLoad ).then( function( response ) {
            for( var i = 0; i < selectedUids.length; i++ ) {
                var selectedParent = cdm.getObject( selectedUids[ i ].uid );
                if( selectedParent.props && selectedParent.props[ property ] && selectedParent.props[ property ].dbValues[ 0 ] ) {
                    var value = selectedParent.props[ property ].dbValues[ 0 ];
                    if( i === 0 ) {
                        headerString = value;
                    } else {
                        headerString = headerString + ' | ' + value;
                    }
                }
            }
            defer.resolve( headerString );
        } );
    }else{
        defer.resolve( '' );
    }
    return defer.promise;
}


/**
 * Method to update the header proeprties in project
 * @param {Object} data the view Model data object
 */
function updateHeaderPropertiesForProject( data ) {
    var deferred = AwPromiseService.instance.defer();

    const taskBarRevisionRule = _.clone( data.taskBarRevisionRule );
    const taskBarVariantRule = _.clone( data.taskBarVariantRule );

    let params = AwStateService.instance.params;
    var selectedParent = cdm.getObject( params.uid );
    //get current revision rule and variant applied to project
    var configurationContextObject = cdm.getObject( _.get( selectedParent, 'props.Att0HasConfigurationContext.dbValues[0]', undefined ) );
    if ( configurationContextObject && configurationContextObject.props ) {
        taskBarRevisionRule.uiValue = configurationContextObject.props.revision_rule.uiValues[ 0 ];
        if( configurationContextObject.props.variant_rule.uiValues[ 0 ] !== '' ) {
            taskBarVariantRule.uiValue = configurationContextObject.props.variant_rule.uiValues[ 0 ];
        }
    }
    deferred.resolve(  {
        taskBarRevisionRule:taskBarRevisionRule,
        taskBarVariantRule:taskBarVariantRule,
        compareType: 'ProjectParamComparison'
    } );
}
/**
  * Method to get the separator to be used
  */
export let getSeparator = function( paramCompareViewContext ) {
    var separator = '^';
    if( paramCompareViewContext && paramCompareViewContext.separator ) {
        separator = paramCompareViewContext.separator;
    }
    return separator;
};

/**
  * Method to set the compare context data.
  * @param {Object} ctx the ctx in which data will be set
  */
export let initializeCompareContext = function( ctx, paramCompareViewContext ) {
    //update the context with param compare type
    return initParamCompareContext( ctx, paramCompareViewContext );
};

/**
 * Method to return # separated uids
 * @param {String} acc uids
 * @param {object} val object
 * @returns {String} returns # separated uids
 */
function uidAccumulator( acc, val ) {
    if( !acc || acc.indexOf( val.uid ) === -1 ) {
        return ( _.isEmpty( acc ) ? '' : acc + getSeparator() ) + val.uid;
    }
    return acc;
}

export let handleLocationChange = function( paramCompareViewContext ) {
    loadComparisonTable( paramCompareViewContext );
    return exports.refreshCompareTable( paramCompareViewContext );
};


export let doPostProcessing = function( paramCompareViewContext ) {
    var paramCompareViewContextCtx = _.clone( paramCompareViewContext );
    paramCompareViewContextCtx.isContextInitailized = false;
    return { paramCompareViewContext:paramCompareViewContextCtx };
};

/**
 * this method to get uids of all selected VR's and studies or recipes
 *  @param {Object} data View model object
 *  @param {Object} ctx the application context
 */
export let addObjectsToCompareInProduct = function addObjectsToCompareInProduct( data, ctx ) {
    //get selected objects from compare object  list
    // if compare url still contains old variables then replace it with comp_uids
    var contextObjUids;
    let params = AwStateService.instance.params;
    if( params.comp_uids ) {
        contextObjUids = params.comp_uids;
    }else if( params.rv_uids ) {
        contextObjUids = params.rv_uids.split( ',' ).join( ctx.parametersTable.separator );
    }else if( params.vrs_uids ) {
        contextObjUids = params.vrs_uids.split( '#' ).join( ctx.parametersTable.separator );
    }else if( params.rcp_uids ) {
        contextObjUids = params.rcp_uids.split( '#' ).join( ctx.parametersTable.separator );
    }

    var comp_uids = _.reduce( data.dataProviders.compareDataProvider.getSelectedObjects(), uidAccumulator, contextObjUids );

    LocationNavigationService.instance.go( '.', {
        comp_uids: comp_uids,
        rv_uids: null,
        vrs_uids: null,
        rcp_uids: null,
        isReloadRequired:true
    } );

    eventBus.publish( 'prm1RevisionRuleCompareTable.reset', {} );
};

/**
 * Method to load location on refresh , it check the previous location to reload
 * @param {object} ctx context
 */
export let goToPreviousIntView = function( commandContext ) {
    var selectedObjects = commandContext.parametersTable.parentObjects;
    let params = AwStateService.instance.params;
    var selectedParent = cdm.getObject( params.uid );
    var sel_uids;
    var productContext = '';
    var showFromChildren = false;
    var curr_rev_rule_uid = null;
    var curr_var_rule_uid = null;
    //if Project compare selected
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
        sel_uids = _.reduce( selectedObjects, uidAccumulator, params.sel_uids );

        //get current revision rule and variant applied to project
        var configurationContextObject = cdm.getObject( _.get( selectedParent, 'props.Att0HasConfigurationContext.dbValues[0]', undefined ) );
        if( configurationContextObject && configurationContextObject.props ) {
            curr_rev_rule_uid = configurationContextObject.props.revision_rule.dbValues[0];
            curr_var_rule_uid = configurationContextObject.props.variant_rule.dbValues[0];
        }
    }
    //else Product compare selected
    else {
        sel_uids = _.reduce( selectedObjects, uidAccumulator, params.sel_uids );
        var occContext = commandContext.context.occContext;
        //get current revision rule applied to product structure
        if( occContext && occContext.productContextInfo && occContext.productContextInfo.props ) {
            curr_rev_rule_uid = occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0];
            productContext =  occContext.productContextInfo.uid;
        }
    }

    var parametersTable = commandContext.parametersTable;
    if( parametersTable.options !== undefined && parametersTable.options.showFromChildren !== undefined ) {
        showFromChildren = parametersTable.options.showFromChildren;
    }

    let navigationParams = {
        uid: params.uid,
        sel_uids: sel_uids,
        productContextUids:productContext,
        showFromChildren:showFromChildren,
        curr_rev_uid:curr_rev_rule_uid,
        curr_var_uid:curr_var_rule_uid,
        isReloadRequired:false
    };
    let action = {
        actionType: 'Navigate',
        navigateTo: 'parameterComparison'
    };
    navigationSvc.navigate( action, navigationParams );
};

/**
 * To initialize parameter context object.
 * @param {object} ctx context object
 */
function _initParamCompareContext( selectedUid, paramCompareViewContext ) {
    var deferred = AwPromiseService.instance.defer();

    dmService.loadObjects( selectedUid ).then( function() {
        var selectedParent = cdm.getObject( selectedUid[ 0 ] );

        if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
            paramCompareViewContext.compareType = 'ProjectParamComparison';
        } else {
            paramCompareViewContext.compareType = 'ProductParamComparison';
        }
        //set view mode for comparison context section
        paramCompareViewContext.ComparisonContextViewMode = 'table';
        //set searchCriteria  in context object
        var comparisonElements = compareService.getComparisonElements( getSeparator( paramCompareViewContext ) );
        paramCompareViewContext.comparisonElements = comparisonElements;

        paramCompareViewContext.isContextInitailized  =  true;
        paramCompareViewContext.requestId = _getRequestId();
        paramCompareViewContext.separator = '^';
        if( comparisonElements.comparisonElementUids === undefined || comparisonElements.comparisonElementUids === null || comparisonElements.comparisonElementUids === '' ) {
            setTimeout( () => {
                eventBus.publish( 'prm1CompareTable.showAddComparisonPanel' );
            }, 1000 );
        }
        deferred.resolve();
    } );

    return deferred.promise;
}

/**
 * Get request id
 */
var _getRequestId = function() {
    return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
        Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
};

/**
 * To initialize parameter context object.
 * @param {object} ctx context object
 */
export let initParamCompareContext = function( ctx, paramCompareViewContext ) {
    var paramCompareViewContextCtx = _.clone( paramCompareViewContext );

    var deferred = AwPromiseService.instance.defer();
    var selectedUid = [];
    let params = AwStateService.instance.params;
    selectedUid.push( params.uid );
    //if ctx.selected is null that means this action is launched from pinned tile
    if( ctx.selected === null ) {
        var comparisionElements = compareService.getComparisonElements( getSeparator( paramCompareViewContext ) );
        paramCompareViewContextCtx.comparisonElements = comparisionElements;

        loadCompareData().then( function( paramCompareCtx ) {
            paramCompareViewContextCtx = { ...paramCompareViewContextCtx, ...paramCompareCtx };
            return _initParamCompareContext( selectedUid, paramCompareViewContextCtx );
        } )
            .then( function() {
                deferred.resolve( paramCompareViewContextCtx );
            } );
    }else {
        _initParamCompareContext( selectedUid, paramCompareViewContextCtx ).then( function() {
            deferred.resolve( paramCompareViewContextCtx );
        } );
    }

    return deferred.promise;
};

/**
 * to returns the resopnce
 * @param {object} mo  vmo
 * @return {objectArray} reponse
 */
export let getDPResponse = function( mo ) {
    var results = _.isArray( mo ) ? mo : [ mo ];
    return { results: results, totalFound: results.length };
};

/**
 * Method to get excluded Rev Rule uids
 * @param {object} data  view model object
 * @returns {String} excluded Rev Rule uids
 */
export let getExcludedRevRuleUids = function() {
    var excludedRevRuleUids;

    let params = AwStateService.instance.params;
    excludedRevRuleUids = params.curr_rev_uid ? params.curr_rev_uid : '';

    if( params.rv_uids && excludedRevRuleUids ) {
        excludedRevRuleUids = excludedRevRuleUids + ',' + params.rv_uids;
    }
    return excludedRevRuleUids;
};


export let handleParameterSelectionChange = function( eventData ) {
    var selectedObjects = eventData.selectedProxyParams;
    if( selectedObjects  ) {
        var isEnabled = true;
        for( var i = 0; i < selectedObjects.length; i++ ) {
            for( var j = 0; j < selectedObjects.length; j++ ) {
                if( i === j ) {
                    continue;
                } else {
                    var uid1 = selectedObjects[i].parentNode;
                    var uid2 = selectedObjects[j].parentNode;
                    if( uid1 === uid2 ) {
                        isEnabled = false;
                        break;
                    }
                }
            }
        }
        return { isPublishCommandEnabled:isEnabled };
    }
};

/**
 * Corrects selection to be source Parameter instead of proxy object
 * @param {Objects} selectedObjects selected object list
 */
export let changeSelection = function( selectedObjects ) {
    // Clear the selected proxy objects
    var sourceSelections = [];
    for( var j = 0; j < selectedObjects.length; ++j ) {
        var objUid = selectedObjects[ j ].props.att1SourceAttribute.dbValue;
        var sourceObj = cdm.getObject( objUid );
        sourceSelections.push( sourceObj );
    }
    if( sourceSelections.length > 0 ) {
        selectionService.updateSelection( sourceSelections );
    }
};

/**
 * to append partial errors if there are more than one error
 * @param {String} messages
 * @param {String} msgObj
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 *  to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

export let getComparisonContextData = function( paramCompareViewContext ) {
    var deferred = AwPromiseService.instance.defer();
    let params = AwStateService.instance.params;
    var contextObjUids = [];
    if( params.comp_uids ) {
        contextObjUids = params.comp_uids.split( getSeparator( paramCompareViewContext ) );
    }else if( params.rv_uids ) {
        contextObjUids = params.rv_uids.split( ',' );
    }else if( params.vrs_uids ) {
        contextObjUids = params.vrs_uids.split( '#' );
    }else if( params.rcp_uids ) {
        contextObjUids = params.rcp_uids.split( '#' );
    }
    var contextObjVMO = [];
    if ( contextObjUids !== null ) {
        contextObjUids = contextObjUids.map( function( obj ) {
            return { uid:obj };
        } );
        var propsToLoad = [ 'object_name', 'object_type', 'object_desc', 'owning_user' ];
        tcVmoService.getViewModelProperties( contextObjUids, propsToLoad ).then( function( response ) {
            for ( var i = 0; i < contextObjUids.length; i++ ) {
                contextObjVMO[i] = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( contextObjUids[ i ].uid ) );
            }
            response = {
                searchResults : contextObjVMO,
                totalFound : contextObjVMO.length
            };
            deferred.resolve( response );
        } );
    }
    return deferred.promise;
};

export let loadComparisonTable = function loadComparisonTable( paramCompareViewContext ) {
    if( paramCompareViewContext && paramCompareViewContext.ComparisonContextViewMode === 'list' ) {
        eventBus.publish( 'prm1CompareTable.loadComparisonContextListView' );
    }else{
        eventBus.publish( 'prm1CompareTable.loadComparisonContextTableView' );
    }
};

export let removeComparisonElements = function removeComparisonElements( vmo, commandContext ) {
    var selectedObjects = [];
    var paramCompareViewCtx = commandContext.context ? commandContext.context.paramCompareViewContext : commandContext.paramCompareViewContext;
    //if remove initiate by hover the tile then selected object is vmo
    if( vmo ) {
        selectedObjects.push( vmo );
    }else{
        selectedObjects = paramCompareViewCtx.selectedComparisonContextObjects;
    }
    let params = AwStateService.instance.params;

    var contextObjUids = [];
    var cmpParam = 'comp_uids';
    //if user want to remove compare object where compare objects in old variables then get the uids from old variables and set it to new comp_uids
    if ( params.comp_uids ) {
        contextObjUids = params.comp_uids.split( getSeparator( paramCompareViewCtx ) );
    }else if( params.rv_uids ) {
        contextObjUids = params.rv_uids.split( ',' );
    }else if( params.vrs_uids ) {
        contextObjUids = params.vrs_uids.split( '#' );
    }else if( params.rcp_uids ) {
        contextObjUids = params.rcp_uids.split( '#' );
    }

    var updatedParams = {};
    _.forEach( selectedObjects, function( removeObj ) {
        contextObjUids = _.filter( contextObjUids, function( u ) {
            return u !== removeObj.uid;
        } );
    } );

    if( contextObjUids.length === 0 ) {
        eventBus.publish( 'prm1CompareTable.showAddComparisonPanel' );
    }

    updatedParams[cmpParam] = _.filter( contextObjUids, function( u ) {
        return u;
    } ).join( getSeparator( paramCompareViewCtx ) );

    //selected objects removed , update selectedComparisonContextObjects with null value
    let paramCompareViewContext = { ...paramCompareViewCtx.value };
    paramCompareViewContext.selectedComparisonContextObjects = null;
    paramCompareViewCtx.update( paramCompareViewContext );

    LocationNavigationService.instance.go( '.', updatedParams );
};

/**
 * Change the view mode from table to list or vice versa
 *
 * @param {String} newViewMode the view mode to switch to
 */
export let changeComparisonViewMode = function( newViewMode, paramCompareViewCtx ) {
    let paramCompareViewContext = { ...paramCompareViewCtx.value };
    paramCompareViewContext.ComparisonContextViewMode = newViewMode;
    paramCompareViewCtx.update( paramCompareViewContext );
};

/**
 * update selected comparison context object in compare context
 * @param {*} data
 */
export let updateComparisonContextSelection = function( data, paramCompareViewCtx ) {
    const paramCompareViewContext = _.clone( paramCompareViewCtx );

    var selectedObj;
    if( paramCompareViewContext && paramCompareViewContext.ComparisonContextViewMode === 'list' ) {
        selectedObj = data.dataProviders.comparisonContextListDataProvider.selectedObjects;
    } else if( paramCompareViewContext && paramCompareViewContext.ComparisonContextViewMode === 'table' ) {
        selectedObj = data.dataProviders.ComparisonContextTableDataProvider.selectedObjects;
    }
    paramCompareViewContext.selectedComparisonContextObjects = selectedObj;

    return {
        paramCompareViewContext:paramCompareViewContext
    };
};

export let prepareInputForPublishParameter = function( parametersTableCtx ) {
    var targetParametersProxy = [];
    var selectedObjects = parametersTableCtx.selectedObjects;
    for( var i = 0; i < selectedObjects.length; i++ ) {
        targetParametersProxy.push( selectedObjects[i] );
        /*  TODO - check multiple target parameter selection
         add partial error
       */
    }
    return [ {
        clientId: 'PublishParameter',
        parametersPublishInput: targetParametersProxy
    } ];
};

export let prepareInputForPublishComparisonEle = function( context, paramCompareViewContext ) {
    var selectedCoparisonElement = undefined;
    var viewMode = paramCompareViewContext.ComparisonContextViewMode;
    if( context && viewMode === 'table' ) {
        selectedCoparisonElement = context.ComparisonContextTableDataProvider.selectedObjects[0];
    } else if( context && viewMode === 'list' ) {
        selectedCoparisonElement = context.comparisonContextListDataProvider.selectedObjects[0];
    }
    let params = AwStateService.instance.params;

    var sourceElement =  params.sel_uids;
    if( sourceElement ) {
        sourceElement = sourceElement.split( getSeparator( paramCompareViewContext ) ).map( function( obj ) {
            return { uid: obj };
        } );
    }
    var comparsionElementUid = '';
    if( selectedCoparisonElement ) {
        comparsionElementUid = selectedCoparisonElement.uid;
    }
    var comparisonElementInput = {
        sourceElements: sourceElement,
        comparsionElement: { uid:comparsionElementUid }
    };

    var requestId = '';
    if( paramCompareViewContext && paramCompareViewContext.requestId ) {
        requestId = paramCompareViewContext.requestId;
    }

    return [ {
        clientId: requestId,
        compElementPublishInput: comparisonElementInput
    } ];
};

export default exports = {
    addObjectsToCompareInProduct,
    goToPreviousIntView,
    initParamCompareContext,
    getDPResponse,
    getExcludedRevRuleUids,
    changeSelection,
    processPartialErrors,
    getComparisonContextData,
    loadComparisonTable,
    removeComparisonElements,
    refreshCompareTable,
    initializeCompareContext,
    handleLocationChange,
    doPostProcessing,
    changeComparisonViewMode,
    updateComparisonContextSelection,
    loadCompareData,
    updateHeaderProperties,
    prepareInputForPublishParameter,
    prepareInputForPublishComparisonEle,
    handleParameterSelectionChange,
    handlePartialError,
    getSeparator
};
