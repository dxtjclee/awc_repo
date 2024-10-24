// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/editParagraphNumber
 */
import dateTimeSrv from 'js/dateTimeService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import uwPropertySvc from 'js/uwPropertyService';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import editHandlerSvc from 'js/editHandlerService';
import appCtxService from 'js/appCtxService';
import AwTimeoutService from 'js/awTimeoutService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';

var exports = {};
var saveHandler = {};

/**
 * Get save handler.
 *
 * @return Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * prepare instance of OccConfigInfo
 *
 * @param {IModelObject} prodCtxt - product context
 * @param {Boolean} isNowUsed - indicates whether to use Now for DateEffectivity
 */
var _prepareOccConfigInfo = function( prodCtxt, isNowUsed ) {
    var effDate = prodCtxt.props.awb0EffDate.dbValues[0];
    var unitEffty = prodCtxt.props.awb0EffUnitNo.dbValues[0];

    // If global revision rule is defined on the product context, send the revision rule as null from client, on server it will read the rule from preference.
    var revRule;
    if ( prodCtxt.props.awb0UseGlobalRevisionRule && prodCtxt.props.awb0UseGlobalRevisionRule.dbValues.length > 0 &&
        prodCtxt.props.awb0UseGlobalRevisionRule.dbValues[0] === '1' ) {
        revRule = null;
    } else {
        revRule = cdm.getObject( prodCtxt.props.awb0CurrentRevRule.dbValues[0] );
    }

    return {
        revisionRule: revRule,
        effectivityDate: effDate ? effDate : dateTimeSrv.NULLDATE,
        now: isNowUsed,
        endItem: cdm.getObject( prodCtxt.props.awb0EffEndItem.dbValues[0] ),
        unitNo: unitEffty ? unitEffty : -1,
        variantRule: cdm.getObject( prodCtxt.props.awb0CurrentVariantRule.dbValues[ 0 ] ),
        configurationObject: cdm.getObject( prodCtxt.props.awb0ContextObject.dbValues[ 0 ] ),
        svrOwningProduct: cdm.getObject( prodCtxt.props.awb0VariantRuleOwningRev.dbValues[ 0 ] )
    };
};

/**
 * get instance of OccConfigInfo.
 *
 */
var _getOccConfigInfo = function() {
    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    var occConfigInfo = _prepareOccConfigInfo( prodCtxt, false );

    if ( occConfigInfo.endItem === null ) {
        occConfigInfo.endItem = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    if ( occConfigInfo.revisionRule === null ) {
        occConfigInfo.revisionRule = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    if ( occConfigInfo.configurationObject === null ) {
        occConfigInfo.configurationObject = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    if ( occConfigInfo.svrOwningProduct === null ) {
        occConfigInfo.svrOwningProduct = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    if ( occConfigInfo.variantRule === null ) {
        occConfigInfo.variantRule = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    return occConfigInfo;
};

/**
 * get instance of RequestPref.
 *
 */
var _getRequestPref = function() {
    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    return {
        base_url: baseURL
    };
};

/**
 * Input for save
 *
 * prepare input of objects and updated Paragraph number which are be re-arenged in the specification
 */
var _getEditParaInput = function() {
    var _interactionEditCtx = 'occDataProvider';
    var editHandler = editHandlerSvc.getEditHandler( _interactionEditCtx );
    var reorderObjData = [];
    var dataSource = editHandler.getDataSource();
    if ( dataSource ) {
        var viewModelObjectList = dataSource.getAllModifiedPropertiesWithVMO();
        for ( var i = 0; i < viewModelObjectList.length; i++ ) {
            var vm = viewModelObjectList[i];
            if ( vm && vm.viewModelObject.props.arm1ParaNumber && vm.viewModelProps[0].propertyName === 'arm1ParaNumber' ) {
                var newParaNumber = vm.viewModelProps[0].newValue;
                var ops = 0;
                var ObjData = {
                    objectToBeRearranged: { uid: vm.viewModelObject.uid },
                    newParaNumber: newParaNumber,
                    operation: ops
                };
                reorderObjData.push( ObjData );
            }
        }
    }
    return reorderObjData;
};

/**
 * Save to Server.
 *
 * @return {Promise} Promise that is resolved when save edit is complete
 */
var _editParaNumber = function() {
    var deferred = AwPromiseService.instance.defer();

    var input = {
        input: [ {
            objectsData: _getEditParaInput(),
            inputContext: {
                configuration: _getOccConfigInfo(),
                pageSize: 40,
                structureContextObject: {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                },
                productContext: {
                    uid: occMgmtStateHandler.getProductContextInfo().uid,
                    type: occMgmtStateHandler.getProductContextInfo().type
                },
                requestPref: _getRequestPref()
            }
        } ]
    };

    var promise = soaSvc.post( 'Internal-AwReqMgmtSe-2018-05-SpecNavigation',
        'moveOccurrences', input );

    promise.then( function( response ) {
        if ( response.newElementInfos[0].childElement.uid ) {
            var context = {
                state: 'saved'
            };
            eventBus.publish( 'editHandlerStateChange', context );

            deferred.resolve( response.newElementInfos[0].childElement );

            AwTimeoutService.instance( function() {
                eventBus.publish( 'aceElementsSelectionUpdatedEvent', {
                    objectsToSelect: { uid: response.newElementInfos[0].childElement.uid }
                } );
                let aceViewKey = appCtxService.getCtx( 'aceActiveContext.key' );
                let acePwaResetEventData = {
                    viewToReset: aceViewKey,
                    silentReload: true
                };
                // Fire an event to refresh ACE view (primary work area)
                eventBus.publish( 'acePwa.reset', acePwaResetEventData ); eventBus.publish( 'acePwa.reset' );
                // Fire an event to refresh Documentation tab
                eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
            }, 500 );
        }
    } )
        .catch( function( error ) {
            if ( error ) {
                messagingService.showError( error.message );
            }
            error = null;
            deferred.reject( error );
        } );

    return deferred.promise;
};

/**
 * custom save handler save edits called by framework
 *
 * @return promisek
 */
saveHandler.saveEdits = function() {
    return _editParaNumber();
};

saveHandler.isDirty = function() {
    var _interactionEditCtx = 'occDataProvider';
    var editHandler = editHandlerSvc.getEditHandler( _interactionEditCtx );
    var dataSource = editHandler.getDataSource();
    var viewModelObjectList = dataSource.getAllModifiedPropertiesWithVMO();
    if ( viewModelObjectList.length === 0 ) {
        return false;
    }
    return true;
};

/**
 * subscribe the  editHandlerStateChange Event and un-subscribe the same for cancelling and saved case
 *
 */
var _subscribeEditHandlerStateChangeEvent = function() {
    var editHandlerStateChangeEvent = eventBus.subscribe( 'editHandlerStateChange', function( event ) {
        if ( event.state === 'canceling' || event.state === 'saved' ) {
            appCtxService.updateCtx( 'editParaNumberSaveHandler', false );
            appCtxService.unRegisterCtx( 'editParaNumberSaveHandler' );
            eventBus.unsubscribe( editHandlerStateChangeEvent );
            editHandlerStateChangeEvent = null;
        }
    } );
};

/**
 * check if Paragraph number Column is present in Column Config and  also visible in tree as a Column.
 *
 */
var _isParagraphNumEditPossible = function( dataSource ) {
    var dataProviderColumn = dataSource.getDataProvider();
    var paragraphnumberColumnPresent = false;
    for ( var i = 0; i < dataProviderColumn.columnConfig.columns.length; i++ ) {
        if ( dataProviderColumn.columnConfig.columns[i].propertyName === 'arm1ParaNumber' && !dataProviderColumn.columnConfig.columns[i].hiddenFlag ) {
            paragraphnumberColumnPresent = true;
        }
    }
    return paragraphnumberColumnPresent;
};

/**
 * Set Paragraph number Column Editable in the tree\tree with Summary  mode in ACE.
 *
 */
export let setParagraphNumEdit = function( data ) {
    var _interactionEditCtx = 'occDataProvider';
    editHandlerSvc.setActiveEditHandlerContext( _interactionEditCtx );
    var editHandler = editHandlerSvc.getEditHandler( _interactionEditCtx );
    var dataSource = editHandler.getDataSource();
    var isParagraphNumColumnPresent = _isParagraphNumEditPossible( dataSource );
    if ( isParagraphNumColumnPresent ) {
        var viewModelObjectList = dataSource.getLoadedViewModelObjects();
        for ( var i = 0; i < viewModelObjectList.length; i++ ) {
            var vm = viewModelObjectList[i];
            if ( vm && vm.props && vm.props.arm1ParaNumber ) {
                vm.props.arm1ParaNumber.isEditable = true;
                vm.props.arm1ParaNumber.isEnabled = true;
                vm.props.arm1ParaNumber.isPropertyModifiable = true;
                //vm.setEditableStates( true, true, true );
                uwPropertySvc.setEditable( vm.props.arm1ParaNumber, true );
                uwPropertySvc.setEditState( vm.props.arm1ParaNumber, true, true );
            }
        }
        editHandler._editing = true;
        // Add to the appCtx about the editing state
        appCtxService.updateCtx( 'editInProgress', editHandler._editing );

        var context = {
            state: 'starting'
        };

        context.dataSource = dataSource.getSourceObject();
        appCtxService.registerCtx( 'editParaNumberSaveHandler', true );
        eventBus.publish( 'editHandlerStateChange', context );
        _subscribeEditHandlerStateChangeEvent();
        // uwPropertySvc.triggerDigestCycle();
    } else {
        messagingService.showInfo( data.i18n.noParagraphNumberColumnPresentError );
    }
};

/**
 * Service for edit Paragraph Number operation in Requirement for non indexed structure.
 *
 * @member editParagraphNumber
 */
export default exports = {
    getSaveHandler,
    setParagraphNumEdit
};
