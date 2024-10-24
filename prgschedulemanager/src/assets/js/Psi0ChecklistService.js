// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0ChecklistService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import soa_dataManagementService from 'soa/dataManagementService';
import colorDecoratorService from 'js/colorDecoratorService';
import ProgramScheduleManagerConstants from 'js/ProgramScheduleManagerConstants';
import _ from 'lodash';
import dms from 'soa/dataManagementService';
import parsingUtils from 'js/parsingUtils';

var exports = {};

var m_openedObj = null;
var _checklistNonModifiableCols = [ 'psi0ID', 'psi0ResponsibleUser', 'psi0Event', 'psi0QuestionNumber', 'psi0ParentChecklist' ];


/**
 * Process the response from Server
 * @argument {Object} response  soa response
 * @returns {Object} checklists checklist object
 */
export let processChecklistObjects = function( response ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    var checklists = [];
    if( response.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( var x = 0; x < searchResults.objects.length; ++x ) {
                var uid = searchResults.objects[ x ].uid;
                var obj = response.ServiceData.modelObjects[ uid ];
                if( obj ) {
                    checklists.push( obj );
                }
            }
        }
    }
    return checklists;
};

/**
 *  Process to get the ChecklistQuestions related to perticular checklist object
 *
 */

export let getChecklistQuestionsSearchResults = function( subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();

    //var checklist = ctx.locationContext.modelObject.uid;

    var checklistQuestionList = [];

    soa_dataManagementService.getProperties( [ subPanelContext.openedObject.uid ], [ 'psi0ChecklistQuestions' ] ).then( function() {
        for( var i = 0; i < subPanelContext.openedObject.props.psi0ChecklistQuestions.dbValues.length; i++ ) {
            var checklistQuestionObject = cdm.getObject( subPanelContext.openedObject.props.psi0ChecklistQuestions.dbValues[ i ] );
            if( checklistQuestionObject ) {
                checklistQuestionList.push( checklistQuestionObject );
            }
        }
        var search = {};
        search.totalFound = checklistQuestionList.length;
        search.totalLoaded = checklistQuestionList.length;
        appCtxService.registerCtx( 'search', search );
        deferred.resolve( checklistQuestionList );
    } );
    return deferred.promise;
};

export let getCreateRelationsInput = function( data, ctx, sourceObjects ) {
    var input = [];
    var inputData = {};
    var primaryObj = {};

    if( ctx.ViewModeContext.ViewModeContext !== 'TableView' && ctx.ViewModeContext.ViewModeContext !== 'TreeView' && ctx.ViewModeContext.ViewModeContext !== 'ListView' ) {
        primaryObj = ctx.xrtSummaryContextObject;
    } else {
        primaryObj = ctx.mselected[0];
    }
    if( data.createdMainObject ) {
        inputData = {
            primaryObject: primaryObj,
            relationType: 'Psi0EventChecklistRelation',
            secondaryObject: data.createdMainObject,
            clientId: '',
            userData: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            }
        };
        input.push( inputData );
    } else {
        for( var index = 0; index < sourceObjects.length; index++ ) {
            inputData = {
                primaryObject: primaryObj,
                relationType: 'Psi0EventChecklistRelation',
                secondaryObject: cdm.getObject( sourceObjects[ index ].uid ),
                clientId: '',
                userData: {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                }
            };
            input.push( inputData );
        }
    }
    return input;
};

/**
 * Method to get Event PrimaryObject  based on sublocation selection
 * @param {ctx} {commandContext}
 */
export let getPrimaryEventObjectForCutChecklist = function( ctx, commandContext ) {
    var primaryObjectCutChecklist = {};
    if( commandContext.pageContext.primaryActiveTabId === 'tc_xrt_Timeline' ) {
        primaryObjectCutChecklist = ctx.xrtSummaryContextObject;
    } else if( commandContext.pageContext.primaryActiveTabId === 'tc_xrt_apqp_Quality' ) {
        primaryObjectCutChecklist = commandContext.provider.openedObject;
    } else{
        primaryObjectCutChecklist = commandContext.openedObject;
    }
    return primaryObjectCutChecklist;
};

/**
 * Method to prepare input to removeChidren SOA Call to cut checklist Object
 * @param {ctx} contextObject - Context Object
 */
export let getInputToCutChecklist = function( ctx, primaryObjectCutChecklist ) {
    var inputData = [];
    var primaryObject = primaryObjectCutChecklist;
    inputData = [ {
        clientId: '',
        propertyName: 'Psi0EventChecklistRelation',
        parentObj: primaryObject,
        childrenObj: ctx.mselected

    } ];
    return inputData;
};

/**
 * Method to set Grid and Cell Decorator calls setDecoratorStyles function
 * @param {ViewModelObject} vmo - ViewModelObject(s) to set style on
 */

export let groupObjectsForDecorators = function( vmos ) {
    exports.setDecoratorStyles( vmos, false );
};

/**
 * Method to set Grid and Cell Decorator style to vmo through Constant Map
 * @param {ViewModelObject} vmo - ViewModelObject(s) to set style on
 */

var setRYGDecorator = function( vmo ) {
    var vmObj = vmo;
    if ( vmo && vmo.modelType && vmo.modelType.typeHierarchyArray && vmo.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) > -1 ) {
        if ( vmo.props.awp0Target.dbValue ) {
            vmObj = cdm.getObject( vmo.props.awp0Target.dbValue );
        }
    }

    if( vmObj && vmObj.props && vmObj.props.apm0RatedReference ) {
        var targetUid = vmObj.props.apm0RatedReference.dbValues;
        var targetObj = cdm.getObject( targetUid );
        var propsToLoad = [ 'apm0Rating' ];
        var uidArr = [ targetUid ];

        dms.getProperties( uidArr, propsToLoad )
            .then(
                function() {
                    if ( targetObj ) {
                        var rygValue = targetObj.props.apm0Rating.dbValues[0];

                        if ( rygValue ) {
                            var rygDecoratorMap = ProgramScheduleManagerConstants.RYG_DECORATOR_STYLE;
                            if ( rygDecoratorMap && rygDecoratorMap[rygValue].cellDecoratorStyle ) {
                                vmo.cellDecoratorStyle = rygDecoratorMap[rygValue].cellDecoratorStyle;
                            }
                            if ( rygDecoratorMap && rygDecoratorMap[rygValue].gridDecoratorStyle ) {
                                vmo.gridDecoratorStyle = rygDecoratorMap[rygValue].gridDecoratorStyle;
                            }
                        } else {
                            vmo.cellDecoratorStyle = '';
                            vmo.gridDecoratorStyle = '';
                        }
                    }
                }
            );
    }
};

/**
 * Method to set Grid and Cell Decorator style to vmo
 * @param {ViewModelObject} vmos - ViewModelObject(s) to set style on
 * @param {Boolean} clearStyles - Clear style passed as false
 */

export let setDecoratorStyles = function( vmos, clearStyles ) {
    _.forEach( vmos, function( vmo ) {
        setRYGDecorator( vmo );
    } );
    colorDecoratorService.setDecoratorStyles( vmos );
};

/**
 * Method to set Grid and Cell Decorator style to vmo
 * @param {ViewModelObject} vmo - ViewModelObject(s) to set style on
 */
export let groupObjectsForDecoratorsChecklistQuestion = function( vmo ) {
    appCtxService.updatePartialCtx( 'decoratorToggle', true );
    setRYGDecorator( vmo );
};

/**
 * Method to set properties on checklist Business Object modifiable
 * @param {Object} columnConfig - columnConfig to set the properties non-modifiable
 * @returns {Object}
 */

export let setNonModifiablePropForAbsChecklist = function( response ) {
    for( var index = 0; index < response.columnConfig.columns.length; index++ ) {
        if( _checklistNonModifiableCols.indexOf( response.columnConfig.columns[ index ].propertyName ) !== -1 ) {
            response.columnConfig.columns[ index ].modifiable = false;
        }
    }
    return response.columnConfig;
};

export default exports = {
    getChecklistQuestionsSearchResults,
    getCreateRelationsInput,
    getInputToCutChecklist,
    groupObjectsForDecorators,
    setDecoratorStyles,
    groupObjectsForDecoratorsChecklistQuestion,
    processChecklistObjects,
    setNonModifiablePropForAbsChecklist,
    getPrimaryEventObjectForCutChecklist
};
