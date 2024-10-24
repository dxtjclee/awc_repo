// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Acp0DefaultNamingConventionsService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import editHandlerService from 'js/editHandlerService';
import listBoxService from 'js/listBoxService';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import acp0RuleNCCondition from 'js/Acp0RuleNCCondUtils';

//Commented Code will be removed , as currently code is not that much mature as part of all the expected use cases.

var exports = {};
var saveEditHandler = {};
let invalidPropList = [];
var callSaveEditSoa = function( input ) {
    return soaSvc.post( 'Internal-AWS2-2018-05-DataManagement', 'saveViewModelEditAndSubmitWorkflow2', input ).then(
        function( response ) {
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            return error;
        }
    );
};

var createSaveEditSoaInput = function( dataSource ) {
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );

    var inputs = [];
    _.forEach( modifiedPropsMap, function( modifiedObj ) {
        var modelObject;
        var viewModelObject = modifiedObj.viewModelObject;

        if ( viewModelObject && viewModelObject.uid ) {
            modelObject = cdm.getObject( viewModelObject.uid );
        }

        if ( !modelObject ) {
            modelObject = {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            };
        }

        var viewModelProps = modifiedObj.viewModelProps;
        var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput( modelObject );
        _.forEach( viewModelProps, function( props ) {
            if ( Array.isArray( props.sourceObjectLastSavedDate ) ) {
                props.sourceObjectLastSavedDate = props.sourceObjectLastSavedDate[0];
            }
            dms.pushViewModelProperty( input, props );
        } );
        inputs.push( input );
    } );
    return inputs;
};

/**
 * custom save handler save edits called by framework
 * @param {dataSource} dataSource of selected object
 * @returns {promise}
 **/
saveEditHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    let vmo = dataSource.getLoadedViewModelObjects();
    invalidPropList = getInvalidPropList( vmo[0] );
    if ( invalidPropList.length ) {
        var errorMessage = appCtxService.ctx.Acp0invalidNCBErrorMsg;
        messagingService.showError( errorMessage );
        //Replace resolve by reject to maintain the edit state for
        //deferred.resolve( {} );
        deferred.reject();
    } else {
        var input = {};
        input.inputs = createSaveEditSoaInput( dataSource );
        callSaveEditSoa( input ).then( function() {
            deferred.resolve( 'successfull' );
        }, function( error ) {
            deferred.reject();
            throw error;
        } );
    }
    return deferred.promise;
};

var getInvalidPropList = function( vmo ) {
    let notNullPropList = [];
    if(vmo && vmo.props)
    {
        notNullPropList = [
        vmo.props.acp0DefaultVarNamingConv,
        vmo.props.acp0DefaultAttNamingConv,
        vmo.props.acp0DefaultVisNamingConv,
        vmo.props.object_name
        ];
    }
    return notNullPropList.filter( function( propertyName ) {
        return !propertyName.dbValue;
    } );

};

/**
 * Returns dirty bit.
 * @param {dataSource} dataSource of selected object
 * @returns {Boolean} isDirty bit
 */
saveEditHandler.isDirty = function( dataSource ) {
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    if(modifiedViewModelProperties.length > 0)
    {
        return true;
    }
    return false;
};

export let getRuleSaveHandler = function() {
    return saveEditHandler;
};

/*
* To load the Naming Convention LOV Values.
*/
export let loadRequiredLOVValues = function() {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Acp0CharsRulesAndNCProvider',
            searchCriteria: {
                type: 'Acp0NamingConvention',
                searchString: ''
            },
            searchSortCriteria: [
                {
                    fieldName: 'creation_date',
                    sortDirection: 'DESC'
                }
            ],
            startIndex: ''
        }
    };
    // SOA call made to get the content
    soaSvc.post( 'Internal-AWS2-2016-03-Finder', 'performSearch', inputData ).then( function( response ) {
        var namingConventions = response.searchResults;
        var validNamingConventions = [];
        for ( var namingConvention of namingConventions ) {
            var ncPropValue = namingConvention.props.acp0NamingConvention.dbValues[0];
            var sctPropValue = namingConvention.props.acp0SourceClassType.dbValues[0];
            if ( ncPropValue && ncPropValue !== '' && sctPropValue && sctPropValue !== '' ) {
                validNamingConventions.push( namingConvention );
            }
        }
        return deferred.resolve( listBoxService.createListModelObjects( validNamingConventions, 'props.acp0NamingConvention' ) );
    } );
    return deferred.promise;
};


export let loadProperties = function( data, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var selectedObject = appCtxService.getCtx( 'xrtSummaryContextObject' );
    // list of list; containing object to check, if loadded, and internal property name
    var requiredPropsListOfList = [
        [ selectedObject.props.acp0DefaultVarNamingConv, 'acp0DefaultVarNamingConv' ],
        [ selectedObject.props.acp0DefaultAttNamingConv, 'acp0DefaultAttNamingConv' ],
        [ selectedObject.props.acp0DefaultVisNamingConv, 'acp0DefaultVisNamingConv' ]
    ];

    var propsToLoad = [];
    _.forEach( requiredPropsListOfList, function( prop ) {
        if ( !prop[0] ) {
            propsToLoad.push( prop[1] );
        }
    } );

    var uids = [ selectedObject.uid ];
    if ( propsToLoad.length > 0 ) {
        dms.getProperties( uids, propsToLoad )
            .then(
                function() {
                    deferred.resolve( bindProperties( data, subPanelContext ) );
                }
            );
    } else {
        deferred.resolve( bindProperties( data, subPanelContext ) );
    }
    return deferred.promise;
};

var getNCString = function( obj ) {
    var ncString = '';
    if ( obj ) {
        obj = cdm.getObject( obj );
        ncString = obj.props.acp0NamingConvention.dbValues[0];
    }
    return ncString;
};

export let bindProperties = function( data, subPanelContext ) {
    let newacp0DefaultVarNamingConvention = subPanelContext.selected.props.acp0DefaultVarNamingConv;
    let newacp0DefaultAttNamingConvention = subPanelContext.selected.props.acp0DefaultAttNamingConv;
    let newacp0DefaultVisNamingConvention = subPanelContext.selected.props.acp0DefaultVisNamingConv;
    //Assign disply value for Var
    newacp0DefaultVarNamingConvention.uiValue = getNCString( subPanelContext.selected.props.acp0DefaultVarNamingConv.dbValue );
    newacp0DefaultVarNamingConvention.hasLov = true;
    newacp0DefaultVarNamingConvention.dataProvider = 'NCProvider';
    newacp0DefaultVarNamingConvention.type = 'STRING';
    //Assign disply value for Att
    newacp0DefaultAttNamingConvention.uiValue = getNCString( subPanelContext.selected.props.acp0DefaultAttNamingConv.dbValue );
    newacp0DefaultAttNamingConvention.hasLov = true;
    newacp0DefaultAttNamingConvention.dataProvider = 'NCProvider';
    newacp0DefaultAttNamingConvention.type = 'STRING';

    //Assign disply value for Vis
    newacp0DefaultVisNamingConvention.uiValue = getNCString( subPanelContext.selected.props.acp0DefaultVisNamingConv.dbValue );
    newacp0DefaultVisNamingConvention.hasLov = true;
    newacp0DefaultVisNamingConvention.dataProvider = 'NCProvider';
    newacp0DefaultVisNamingConvention.type = 'STRING';








    
    newacp0DefaultVarNamingConvention.isRequired = true;
    newacp0DefaultAttNamingConvention.isRequired = true;
    newacp0DefaultVisNamingConvention.isRequired = true;

    appCtxService.registerCtx( 'Acp0invalidNCBErrorMsg', data.i18n.Acp0invalidNCBErrorMsg );
    let newdefaultNCLoaded = true;
    return {
        acp0DefaultVarNamingConvention: newacp0DefaultVarNamingConvention,
        acp0DefaultAttNamingConvention: newacp0DefaultAttNamingConvention,
        acp0DefaultVisNamingConvention: newacp0DefaultVisNamingConvention,
        defaultNCLoaded: newdefaultNCLoaded
    };
};

export let DefNCEditStateChanger = function( data, subPanelContext ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();

    let newacp0DefaultVarNamingConvention = {...data.acp0DefaultVarNamingConvention};
    let newacp0DefaultAttNamingConvention = {...data.acp0DefaultAttNamingConvention};
    let newacp0DefaultVisNamingConvention = {...data.acp0DefaultVisNamingConvention};

    let newNamingConvention;
    if ( activeEditHandler ) {
        newacp0DefaultVarNamingConvention.isEditable = activeEditHandler.editInProgress();
        newacp0DefaultAttNamingConvention.isEditable = activeEditHandler.editInProgress();
        newacp0DefaultVisNamingConvention.isEditable = activeEditHandler.editInProgress();

        if ( activeEditHandler.editInProgress() ) {
            newNamingConvention = loadRequiredLOVValues();
        }
        else{
            newacp0DefaultVarNamingConvention.valueUpdated = false;
            newacp0DefaultAttNamingConvention.valueUpdated = false;
            newacp0DefaultVisNamingConvention.valueUpdated = false;
    
        }
        //set default editable mode when we caught any error
        if ( invalidPropList.length && !activeEditHandler.editInProgress() ) {
            acp0RuleNCCondition.setPropertyInEditMode( data, activeEditHandler, 'Acp0Rule', subPanelContext );
        }
    }
    
    return {
        NamingConvention: newNamingConvention,
        acp0DefaultVarNamingConvention: newacp0DefaultVarNamingConvention,
        acp0DefaultAttNamingConvention: newacp0DefaultAttNamingConvention,
        acp0DefaultVisNamingConvention: newacp0DefaultVisNamingConvention
    };
};


export let varNCChangeAction = function( acp0DefaultVarNamingConvention, defaultNCLoaded ) {
    let prop = { ...acp0DefaultVarNamingConvention };
    if ( defaultNCLoaded ) {
        if ( prop.dbValue || !prop.uiValue ) {
            var ncuid = prop.dbValue ? prop.dbValue.uid : '';
            prop.dbValue = ncuid ? ncuid : prop.dbValue;
        }
    }
    return { acp0DefaultVarNamingConvention: prop };
};

export let attNCChangeAction = function( acp0DefaultAttNamingConvention, defaultNCLoaded ) {
    var prop = { ...acp0DefaultAttNamingConvention };
    if ( defaultNCLoaded ) {
        if ( prop.dbValue || !prop.uiValue ) {
            var ncuid = prop.dbValue ? prop.dbValue.uid : '';
            prop.dbValue = ncuid ? ncuid : prop.dbValue;
        }
    }
    return { acp0DefaultAttNamingConvention: prop };
};

export let visNCChangeAction = function( acp0DefaultVisNamingConvention, defaultNCLoaded ) {
    var prop = { ...acp0DefaultVisNamingConvention };
    if ( defaultNCLoaded ) {
        if ( prop.dbValue || !prop.uiValue ) {
            var ncuid = prop.dbValue ? prop.dbValue.uid : '';
            prop.dbValue = ncuid ? ncuid : prop.dbValue;
        }
    }
    return { acp0DefaultVisNamingConvention: prop };
};


export default exports = {
    loadProperties,
    bindProperties,
    DefNCEditStateChanger,
    loadRequiredLOVValues,
    getRuleSaveHandler,
    varNCChangeAction,
    attNCChangeAction,
    visNCChangeAction
};
