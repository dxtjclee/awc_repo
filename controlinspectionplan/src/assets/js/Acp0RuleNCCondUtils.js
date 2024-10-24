// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for Rule, Naming Convention, Condition Object oprtaions.
 * @module js/Acp0RuleNCCondUtils
 */
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import commonUtils from 'js/Acp0CommonUtils';
import dms from 'soa/dataManagementService';
import awTableSvc from 'js/awTableService';
import uwPropertySvc from 'js/uwPropertyService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import awColumnSvc from 'js/awColumnService';
import messagingSvc from 'js/messagingService';
import listBoxService from 'js/listBoxService';
import awTableStateService from 'js/awTableStateService';
import uwUtilSvc from 'js/uwUtilService';
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};
var _maxTreeLevel = 3;
var _deferExpandTreeNodeArray = [];
var _treeTableColumnInfos = null;
var _mapOfRuleCondsAndCondExprs = new Map();
var getInitialLOVValueDeferred = null;
var prev_location_context = '';
var _firstColumnPropertyName = null;

/**
 * Map of nodeId of a 'parent' TableModelObject to an array of its 'child' TableModelObjects.
 */
var _mapNodeId2ChildArray = {};
var _sourceclassList = {};
var _acp0SourceClassTypeValues = [];
var _mapOfPropNameDispValue = new Map();


/**
 *This method ensures that to load required properties.
 */
export let loadRequiredProperties = function( selectedCondObj, data, ruleBuilderPanelFlag, context, config ) {
    var deferred = AwPromiseService.instance.defer();

    var propsToLoad = [];
    var uids = [ selectedCondObj.uid ];
    if( selectedCondObj.type === 'Acp0Rule' ) {
        var ruleCond = selectedCondObj.props.acp0RuleCondition;
        if( ruleCond && ruleCond.dbValues.length > 0 ) {
            for( var eachCond of ruleCond.dbValues ) {
                uids.push( eachCond );
            }
            selectedCondObj = cdm.getObject( ruleCond.dbValues[ 0 ] );
        } else {
            propsToLoad = [ 'acp0RuleCondition' ];
            propsToLoad = commonUtils._toPreparePropstoLoadData( selectedCondObj, propsToLoad );
        }
    }
    if( selectedCondObj.type === 'Acp0RuleCondition' ) {
        propsToLoad = [ 'acp0Expresion', 'acp0NamingConventionRef', 'acp0NamingConvention' ];
        propsToLoad = commonUtils._toPreparePropstoLoadData( selectedCondObj, propsToLoad );
    }
    if( propsToLoad.length > 0 ) {
        dms.getProperties( uids, propsToLoad )
            .then(
                function() {
                    if( ruleBuilderPanelFlag ) {
                        deferred.resolve( commandPanelService.activateCommandPanel( 'Acp0AddExprsForCondBuild', 'aw_toolsAndInfo', context, null, null, config ) );
                    } else {
                        //deferred.resolve(_getSourceAttLOVValues(undefined, 'acp0SourceClassType', undefined, undefined));
                    }
                }
            );
    } else {
        if( ruleBuilderPanelFlag ) {
            deferred.resolve( commandPanelService.activateCommandPanel( 'Acp0AddExprsForCondBuild', 'aw_toolsAndInfo' ) );
        }
    }
    return deferred.promise;
};
export let loadCondExprTreeTableData = async function() {
    var treeLoadInput = arguments[ 0 ];
    var i18nStrings = arguments[ 1 ];
    var data = arguments[ 2 ];

    let newTreeLoadResult = { ...data.treeLoadResult };

    newTreeLoadResult = await loadData( treeLoadInput, i18nStrings );
    return{ treeLoadResult:newTreeLoadResult };
};

/**
 * Note : Load the tree table data. Create VMOs of all conditions/expressoons and return
 * @param {treeLoadInput}
 * @param {i18nString}
 *
 * @return {treeLoadResult}
 */
async function loadData(  treeLoadInput, i18nString ) {
    var children = [];
    var children1 = [];
    var ctx = appCtxService.getCtx();
    var selectedRule = ctx.selected;

    if( selectedRule.type !== 'Acp0Rule' ) {
        selectedRule = ctx.pselected;
    }

    var parentNode  = treeLoadInput.parentNode;
    var levelNdx = parentNode.levelNdx + 1;
    var condProp = selectedRule.props.acp0RuleCondition;
    var hasConditions = condProp ? condProp.dbValues : condProp;
    var isLoadAllEnabled = true;
    var columnInfos = _getTreeTableColumnInfos( i18nString );
    const promises = [];
    var nodeBeingExpanded  = parentNode;


    // When data first time then _mapOfPropNameDispValue, _acp0SourceClassTypeValues are empty.therefore proper data is not shown in correctly.
    // To fix this issue, added await  _getSourceAttLOVValues.
    _mapOfPropNameDispValue.size === 0 || _acp0SourceClassTypeValues.length === 0 ?  await  _getSourceAttLOVValues( undefined, 'acp0SourceClassType', undefined, undefined ) :   _getSourceAttLOVValues( undefined, 'acp0SourceClassType', undefined, undefined );

    if( parentNode.levelNdx < 0 ) {
        // load all conditions
        if( hasConditions ) {
            for( var childNdx = 0; childNdx < hasConditions.length; childNdx++ ) {
                var child = cdm.getObject( hasConditions[ childNdx ] );
                if( child.uid ) {
                    promises.push( exports.createVmNodeUsingNewObjectInfo(  child, levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nString ) );
                }
            }
            const vmnodes = await Promise.all( promises );
            for( var childNdx = 0; childNdx < hasConditions.length; childNdx++ ) {
                var child = cdm.getObject( hasConditions[ childNdx ] );
                vmnodes[childNdx].vmNode.totalSiblings = hasConditions.length;
                children.push( vmnodes[childNdx].vmNode );
            }
        }
    }else  if( parentNode.levelNdx < _maxTreeLevel && parentNode.levelNdx >= 0 ) {
        // load all expressions
        var loadChxObjectInput = {
            objects: [ cdm.getObject( parentNode.uid ) ],
            attributes: [ 'acp0Expresison' ]
        };
        var vmnodes = [];
        if( loadChxObjectInput.objects[ 0 ].type === 'Acp0RuleCondition' ) {
            var ChildVMO = loadChxObjectInput.objects[ 0 ];
            var condObj = ChildVMO.props.acp0Expresison;
            if( condObj && condObj.dbValues.length > 0 ) {
                for( var i = 0; i < condObj.dbValues.length; i++ ) {
                    var temp = ChildVMO.props.acp0Expresison.dbValues[ i ];
                    children.push( temp );
                }
            }

            for( var childNdx = 1; childNdx <= children.length; childNdx++ ) {
                vmnodes.push( createVmNodeUsingNewObjectInfoForChildObject(  children[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nString ) );

                // totalSiblings is use for Move Up/ Move Down command visibility
                vmnodes[childNdx - 1].totalSiblings = children.length;
                children1.push( vmnodes[childNdx - 1] );
            }
        }
    }
    var childNodes = [];
    if( children1.length > 0 ) {
        childNodes = children1;
    }else {
        childNodes = children;
    }

    return {
        parentNode :nodeBeingExpanded,
        childNodes:childNodes,
        totalChildCount: children.length,
        startChildNdx :0
    };
}

/**
 * create VMO node for expressions

 */
function createVmNodeUsingNewObjectInfoForChildObject(  modelObject, levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nStrings ) {
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = '';
    var iconURL = '';
    var operator = '';
    var relAndValue = '';
    var attPropName = '';
    var typeForIcon = '';
    //This block to evaluate the expression Attribute should show display value on UI(In expression, saving the internal name of attribute property)
    if( levelNdx === 1 ) {
        if( childNdx !== 1 ) {
            //This line is to show Display string for operator
            //After 'OR' operator has one extra space to manage the length of both operator for display purpose.
            operator = modelObject.split( /\s(.+)/ )[ 0 ] === '&&' ? 'AND' + '\xa0' : '\xa0' + 'OR' + '\xa0\xa0\xa0';
            //This line is to show the Icon for operator
            //typeForIcon = modelObject.split( /\s(.+)/ )[0] === '&&' ? 'Acp0ANDOperatorIcon' : 'Acp0OROperatorIcon';
            var expr = modelObject.split( /\s(.+)/ )[ 1 ];
            attPropName = expr.split( /\s(.+)/ )[ 0 ];
            relAndValue = expr.split( /\s(.+)/ )[ 1 ];
        } else {
            //Below line to manage the empty space when there is no operator
            typeForIcon = 'Acp0NoOperatorIcon';
            attPropName = modelObject.split( /\s(.+)/ )[ 0 ];
            relAndValue = modelObject.split( /\s(.+)/ )[ 1 ];
        }
        // Assigning node id as in case of expression(As its string prop) it is getting undefine
        // Condition selection was not working. So we are creating uid to each row.
        nodeId = parentNode.uid + childNdx;
    }


    var attPropDispValue = _mapOfPropNameDispValue.get( attPropName );


    if( !attPropDispValue ) {
        var reqMessage = i18nStrings.propMissingInLOV;
        var message = reqMessage ? reqMessage.replace( '{0}', attPropName ) : reqMessage;
        console.error( message );
    }

    //As we are displaying text for operator this line required
    attPropDispValue = attPropDispValue ? attPropDispValue : attPropName;
    modelObject = operator + attPropDispValue + ' ' + relAndValue;
    //As we are back to text scenario for Operator below line not returning any icon
    iconURL = iconSvc.getTypeIconURL( typeForIcon );
    displayName = modelObject;

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;
    vmNode.props = {};
    vmNode.isLeaf = true;
    vmNode.parentNodeUid = parentNode.uid;

    return vmNode;
}

/**
 * create VMO node for conditions

 */
async function createVmNodeUsingNewObjectInfo(  modelObject, levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nStrings ) {
    var deferred = AwPromiseService.instance.defer();
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = '';
    var iconURL = '';

    if( nodeId ) {
        var ncOnCond = modelObject.props.acp0NamingConvention;
        var ncString = ncOnCond ? ncOnCond.dbValues[ 0 ] : ncOnCond;
        //Display Naming Convention string as Set NC: 'ncString' If
        displayName = i18nStrings.setNCString + ' ("' + ncString + '") ' + i18nStrings.ifString;
        iconURL = iconSvc.getTypeIconURL( type );
    }
    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;
    vmNode.modelType.props = modelObject.props;

    if( nodeId ) {
        containChildren(   modelObject.props, vmNode ).then( function( responseData ) {
            if( responseData ) {
                responseData.selected = true;
                if( !responseData.modelType ) {
                    responseData.parentNodeUid = parentNode.uid;
                    // vmNode.parentNode = parentNode;
                }
                _populateColumns( columnInfos, isLoadAllEnabled, responseData, childNdx, modelObject.props );
            }
            return deferred.resolve(  responseData  );
        } );
    }else {
        return deferred.resolve( vmNode );
    }

    return deferred.promise;
}
/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( uwDataProvider, i18nStrings ) {
    var deferred = AwPromiseService.instance.defer();
    appCtxService.registerCtx( 'treeVMO', uwDataProvider );
    var awColumnInfos = _getTreeTableColumnInfos( i18nStrings );
    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };
    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * Get a page of row column data for a tree-table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {PropertyLoadInput} propertyLoadInput - (found within the 'arguments' property passed to this function) The
 * PropertyLoadInput contains an array of PropertyLoadRequest objects this action function is invoked to
 * resolve.
 *
 * @return {Promise} A Promise resolved with a 'PropertyLoadResult' object containing the details of the result.
 */
export let loadcondExprTreeProperties = function() {
    var propertyLoadInput;
    var delayTimeProperty = 0;
    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];
        if( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        } else if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeProperty' ) {
            delayTimeProperty = arg.dbValue;
        }
    }
    var deferred = AwPromiseService.instance.defer();
    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if( delayTimeProperty > 0 ) {
        _.delay( _loadProperties, delayTimeProperty, deferred, propertyLoadInput );
    } else {
        if( propertyLoadInput ) {
            _loadProperties( deferred, propertyLoadInput );
        }
    }
    return deferred.promise;
};

/*
 * This method return updated list of Conditions or Expressions.
 */
export let getCondorExpToAdd = function( ctx, data, panelContext ) {
    var returnCondorExpVal = [];
    var selections;
    var toGetPropName;
    var dataToBePush;
    selections = ctx.mselected;
    for( var im = 0; im < selections.length; im++ ) {
        var objectwithPropAndDP = _toGetObjectAndPropNameToAddRemoveCondsOrExps( selections[ im ], data );
        toGetPropName = objectwithPropAndDP.toGetPropName;
        dataToBePush = objectwithPropAndDP.dataToBePush;
        var getCondorExpr = selections[ im ].props[ toGetPropName ].dbValues;
        getCondorExpr.push( dataToBePush );
        for( var i = 0; i < getCondorExpr.length; i++ ) {
            returnCondorExpVal.push( getCondorExpr[ i ].toString() );
        }
    }

    if( ctx.selected.type === 'Acp0Rule' ) {
        addSiblingElement( panelContext, data.createdCondObject  );
    }

    if( ctx.selected.type === 'Acp0RuleCondition' ) {
        addChildElement( panelContext );
    }
    return returnCondorExpVal;
};


export let getRemoveExprOrCondnInfo = function( ) {
    var ctx = appCtxService.getCtx();
    var info = [];
    var selections;
    var toGetPropObject;
    var toGetPropName;
    _mapOfRuleCondsAndCondExprs = new Map();
    var mapOfIndexOfSelectedCondsAndExprs = new Map();
    var treeVMOSelecions = ctx.treeVMO ? ctx.treeVMO.selectedObjects : [];
    // In Selection model some time tree node selection not getting correct so handle here.
    if( treeVMOSelecions.length > 0 ) {
        selections = treeVMOSelecions;
    } else {
        selections = ctx.mselected;
    }
    for( var im = 0; im < selections.length; im++ ) {
        toGetPropObject = _toGetSelectedObjectAndPropName( selections[ im ] ).toGetPropObject;
        //Manage map with selcted conditions and expressions based on index.
        if( treeVMOSelecions.length > 0 ) {
            if( !mapOfIndexOfSelectedCondsAndExprs.get( toGetPropObject ) ) {
                if( selections[im].type === 'Acp0RuleCondition' ) {
                    mapOfIndexOfSelectedCondsAndExprs.set( toGetPropObject, [ selections[ im ].childNdx ] );
                } else {
                    mapOfIndexOfSelectedCondsAndExprs.set( toGetPropObject, [ selections[ im ].childNdx - 1 ] );
                }
            } else {
                var availableIndexList = mapOfIndexOfSelectedCondsAndExprs.get( toGetPropObject );

                if( selections[im].type === 'Acp0RuleCondition' ) {
                    availableIndexList.push( selections[ im ].childNdx );
                }else{
                    availableIndexList.push( selections[ im ].childNdx - 1 );
                }
                mapOfIndexOfSelectedCondsAndExprs.set( toGetPropObject, availableIndexList );
            }
        } else {
            mapOfIndexOfSelectedCondsAndExprs.set( toGetPropObject, [] );
        }
    }
    for( var eachCondOrExprData of mapOfIndexOfSelectedCondsAndExprs.entries() ) {
        var getupdatedCondsorExprs = [];
        var infoInput;
        var toGetPropObjectAndProp = _toGetObjectAndPropNameToAddRemoveCondsOrExps( eachCondOrExprData[ 0 ] );
        toGetPropName = toGetPropObjectAndProp.toGetPropName;
        if( eachCondOrExprData[ 1 ].length > 0 ) {
            //Fetching the Expressions or Conditions
            var getCondorExprs = eachCondOrExprData[ 0 ].props[ toGetPropName ].dbValues;
            //Remove the selected Expressions or Conditions from fetched data
            getupdatedCondsorExprs = $.grep( getCondorExprs, function( n, i ) {
                return $.inArray( i, eachCondOrExprData[ 1 ] ) === -1;
            } );
            //Checking the selected expression is on first index
            if( eachCondOrExprData[ 0 ].type === 'Acp0RuleCondition' && eachCondOrExprData[ 1 ].indexOf( 0 ) > -1 && getupdatedCondsorExprs.length > 0 ) {
                //Need to remove operator from first expression
                getupdatedCondsorExprs[ 0 ] = getupdatedCondsorExprs[ 0 ].split( /\s(.+)/ )[ 1 ];
            }
        }
        //Adding expected Expressions or Conditions to map for processing the operations.
        _mapOfRuleCondsAndCondExprs.set( eachCondOrExprData[ 0 ], getupdatedCondsorExprs );
    }
    // This Loop required to manage if user selects a expression which parent condition is already part of removal operation.
    for( var eachCondnorExpr of _mapOfRuleCondsAndCondExprs ) {
        if( eachCondnorExpr[ 0 ].type === 'Acp0RuleCondition' ) {
            var getRuleObjToCheckSelectedConds = ctx.pselected;
            var updatedCondsOrExprs = _mapOfRuleCondsAndCondExprs.get( getRuleObjToCheckSelectedConds );
            // To check the condition is part of removal already, if yes then no need to process expression of that condition for removal.
            if( updatedCondsOrExprs !== undefined && updatedCondsOrExprs.indexOf( eachCondnorExpr[ 0 ].uid ) > -1 || !updatedCondsOrExprs ) {
                infoInput = _toPrepareSetPropertiesSOAInput( eachCondnorExpr[ 0 ], 'acp0Expresison', eachCondnorExpr[ 1 ] );
                info.push( infoInput );
            }
        } else {
            infoInput = _toPrepareSetPropertiesSOAInput( eachCondnorExpr[ 0 ], 'acp0RuleCondition', eachCondnorExpr[ 1 ] );
            info.push( infoInput );
        }
    }
    return info;
};

// Remove conditions or expressions
export let removeElement = function( commandContext ) {
    var provider = commandContext.dataProviders.condExprDataProvider;
    var treeLoadResult = commandContext.treeLoadResult;
    var vmc = provider.viewModelCollection;
    var loadedVMOs;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    var removedObjects = provider.selectedObjects;
    if( removedObjects.length > 0 ) {
        _.forEach( removedObjects, function( removedObject ) {
            var parentObject = treeLoadResult.parentNode;
            var objectsToBeRemoved = [];
            var removeChildren = function( parentObject ) {
                //check if removed child has any further children, if so removed them first
                if( parentObject.children !== undefined ) {
                    var removedObjChildren = parentObject.children;
                    _.forEach( removedObjChildren, function( removedChild ) {
                        removeChildren( removedChild );
                    } );
                }
                objectsToBeRemoved.push( parentObject );
            };
            if( removedObject.children && removedObject.children.length ) {
                removeChildren( removedObject );
            } else {
                objectsToBeRemoved.push( removedObject );
            }
            for( var i = 0; i < objectsToBeRemoved.length; i++ ) {
                removeFromVMCollectionIfApplicable( vmc, loadedVMOs, parentObject, objectsToBeRemoved[i] );
            }
        } );
        provider.update( loadedVMOs );

        if( removedObjects[0].type === 'Acp0RuleCondition' && loadedVMOs.length === 0 ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
};

var removeFromVMCollectionIfApplicable = function( vmc, loadedVMOs, parentObject, removedObject ) {
    _.remove( loadedVMOs, function( vmo ) {
        if( vmo.uid && removedObject.uid &&
             vmo.uid === removedObject.uid ) {
            var parentOfVMO = parentObject;
            var parentNode = vmc.getViewModelObject( vmc.findViewModelObjectById( parentOfVMO.uid ) );
            var childrenNode = vmc.getViewModelObject( vmc.findViewModelObjectById( vmo.uid ) );
            removeChildFromParentChildrenArray( parentNode, childrenNode );
            return true;
        }
    } );
};

export let removeChildFromParentChildrenArray = function( parentNode, childNode ) {
    if( parentNode && parentNode.children && parentNode.children.length > 0 ) {
        var ndx = _.findLastIndex( parentNode.children, function( vmo ) {
            return vmo.uid === childNode.uid;
        } );
        if( ndx > -1 ) {
            parentNode.children.splice( ndx, 1 );
            if( parentNode.children.length === 0 ) {
                parentNode.expanded = false;
                parentNode.isExpanded = false;
                parentNode.isLeaf = true;
                delete parentNode.children;
            }
        }
    }
};


/*
 * To Show the proper error messages.
 */
export let getMultipleObjDeleteMessageData = function( ctx, data ) {
    //var treeVMOSelecions = ctx.treeVMO.selectedObjects;
    var treeVMOSelecions;
    var treeVMOSelecion = ctx.treeVMO ? ctx.treeVMO.selectedObjects : [];
    // In Selection model some time tree node selection not gettig correct in multiselection so handle here.
    if( treeVMOSelecion.length > 0 ) {
        treeVMOSelecions = treeVMOSelecion;
    } else {
        treeVMOSelecions = ctx.mselected;
    }
    var conditions = [];
    var expressions = [];
    for( var im = 0; im < treeVMOSelecions.length; im++ ) {
        if( treeVMOSelecions[ im ].type === 'Acp0RuleCondition' ) {
            conditions.push( treeVMOSelecions[ im ].props.acp0NamingConventionRef.uiValues[ 0 ] );
        } else if( !treeVMOSelecions[ im ].type ) {
            expressions.push( treeVMOSelecions[ im ].displayName );
        }
    }
    var selectionCount = conditions.length + expressions.length;
    if( conditions.length > 0 ) {
        var message = data.i18n.deleteCondOrExpr.replace( '{0}', selectionCount );
        messagingSvc.showInfo( message );
    }
    return message;
};
/*
 * To get updated sequence for Conditions or Expressions.
 */
export let toMoveDownOrMoveUpTheSelCondOrExpr = function( activeCommandId ) {
    var info = [];
    var ctx = appCtxService.getCtx();
    // Note : indexing of conditions are 0 based and indexing og expressions is 1 based

    var selectedObjects;
    var treeVMOSelecions = ctx.treeVMO ? ctx.treeVMO.selectedObjects : [];
    // In Selection model some time tree node selection not gettig correct so handle here.
    if( treeVMOSelecions.length > 0 ) {
        selectedObjects = treeVMOSelecions;
    } else {
        selectedObjects = ctx.mselected;
    }

    var selectedCondorExp = selectedObjects[ 0 ];
    var indexOfSelection = selectedObjects[ 0 ].childNdx - 1;
    var togetTypeObjectAndProp = _toGetSelectedObjectAndPropName( selectedCondorExp );
    var toGetPropObject = togetTypeObjectAndProp.toGetPropObject;
    var toGetPropName = togetTypeObjectAndProp.toGetPropName;
    var getCondorExprs = toGetPropObject.props[ toGetPropName ].dbValues;
    // indexing of conditions are 0 based therefore we are incrementing it by 1
    if( toGetPropObject.type === 'Acp0Rule' && activeCommandId !== 'Acp0ChangeOperatorForExprs' )  {
        indexOfSelection += 1;
    }

    if( activeCommandId === 'Acp0MoveDownCondForCondBuild' ) {
        if( indexOfSelection === 0 && toGetPropObject.type === 'Acp0RuleCondition' ) {
            var operator = getCondorExprs[ indexOfSelection + 1 ].split( /\s(.+)/ )[ 0 ];
            getCondorExprs[ indexOfSelection + 1 ] = getCondorExprs[ indexOfSelection + 1 ].split( /\s(.+)/ )[ 1 ];
            getCondorExprs[ indexOfSelection ] = operator + ' ' + getCondorExprs[ indexOfSelection ];
        }
        [ getCondorExprs[ indexOfSelection ], getCondorExprs[ indexOfSelection + 1 ] ] = [ getCondorExprs[ indexOfSelection + 1 ], getCondorExprs[ indexOfSelection ] ];
    } else if( activeCommandId === 'Acp0MoveUpCondForCondBuild' ) {
        if( indexOfSelection === 1 && toGetPropObject.type === 'Acp0RuleCondition' ) {
            var operator = getCondorExprs[ indexOfSelection ].split( /\s(.+)/ )[ 0 ];
            getCondorExprs[ indexOfSelection ] = getCondorExprs[ indexOfSelection ].split( /\s(.+)/ )[ 1 ];
            getCondorExprs[ indexOfSelection - 1 ] = operator + ' ' + getCondorExprs[ indexOfSelection - 1 ];
        }
        [ getCondorExprs[ indexOfSelection - 1 ], getCondorExprs[ indexOfSelection ] ] = [ getCondorExprs[ indexOfSelection ], getCondorExprs[ indexOfSelection - 1 ] ];
    } else if( activeCommandId === 'Acp0ChangeOperatorForExprs' ) {
        var operator = getCondorExprs[ indexOfSelection ].split( /\s(.+)/ )[ 0 ];
        var expression = getCondorExprs[ indexOfSelection ].split( /\s(.+)/ )[ 1 ];
        operator = operator === '&&' ? '||' : '&&';
        getCondorExprs[ indexOfSelection ] = operator + ' ' + expression;
    }
    info.push( _toPrepareSetPropertiesSOAInput( toGetPropObject, toGetPropName, getCondorExprs ) );
    return info;
};

/*
 * To load the Naming Convention LOV Values.
 */
export let loadRequiredLOVValues = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var ctx = appCtxService.getCtx();
    let newNamingConvention = { ...data.NamingConvention };
    let newOperator =  { ...data.operator };
    let newAcp0NamingConvention =  { ...data.acp0NamingConvention };
    if( ctx.selected.type === 'Acp0RuleCondition' ) {
        newOperator.isRequired = true;
        newAcp0NamingConvention.isRequired = false;
    }
    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Acp0CharsRulesAndNCProvider',
            searchCriteria: {
                type: 'Acp0NamingConvention',
                searchString: ''
            },
            searchSortCriteria: [ {
                fieldName: 'creation_date',
                sortDirection: 'DESC'
            } ],
            startIndex: ''
        }
    };
    // SOA call made to get the content
    soaSvc.post( 'Internal-AWS2-2016-03-Finder', 'performSearch', inputData ).then( function( response ) {
        var namingConventions = response.searchResults;
        var validNamingConventions = [];
        for( var namingConvention of namingConventions ) {
            var ncPropValue = namingConvention.props.acp0NamingConvention.dbValues[ 0 ];
            var sctPropValue = namingConvention.props.acp0SourceClassType.dbValues[ 0 ];
            if( ncPropValue && ncPropValue !== '' && sctPropValue && sctPropValue !== '' ) {
                validNamingConventions.push( namingConvention );
            }
        }
        newNamingConvention = listBoxService.createListModelObjects( validNamingConventions, 'props.acp0NamingConvention' );
        if( newNamingConvention.length > 0 ) {
            newAcp0NamingConvention.dbValue = newNamingConvention[0].propInternalValue;
            newAcp0NamingConvention.uiValue = newNamingConvention[0].propDisplayValue;
            newAcp0NamingConvention.dbValues = [ newNamingConvention[0].propInternalValue ];
            newAcp0NamingConvention.uiValues = [ newNamingConvention[0].propDisplayValue ];
        }
        return deferred.resolve( { NamingConvention: newNamingConvention, Operator: newOperator, acp0NamingConvention : newAcp0NamingConvention } );
    } );
    return deferred.promise;
};

/**
 * This method is used to get the LOV values.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};

/*
 * To load the Source Attribute LOV Values based on selected Naming Convention.
 */

export let loadSourceAttributeLOVValues = async function( fields, data ) {
    let SourceAttributeList = [];
    let sourceAttributeVal = { ...data.sourceAttribute };
    var ctx = appCtxService.getCtx();
    var selectedNC = data.acp0NamingConvention.dbValue;
    var selectedNCUid = selectedNC ? selectedNC.uid : undefined;
    var selectedcond;
    var treeVMOSelecions = ctx.treeVMO ? ctx.treeVMO.selectedObjects : [];
    // In Selection model some time tree node selection not gettig correct in multiselection so handle here.
    if( treeVMOSelecions.length > 0 ) {
        selectedcond = treeVMOSelecions;
    } else {
        selectedcond = ctx.mselected;
    }

    if( !selectedNC && selectedcond.length === 1 && selectedcond[ 0 ].type === 'Acp0RuleCondition' ) {
        selectedNCUid = selectedcond[ 0 ].props.acp0NamingConventionRef.dbValues[ 0 ];
    }
    if( selectedNCUid ) {
        SourceAttributeList = await _getSourceAttLOVValues( selectedNCUid, 'acp0SourceClassAttribute', undefined, data  );
        // LCS-765046 [priority 70.0]: Cannot add expressions to the Naming Rule once deleted
        // selects the expressions -> provide all the valid values -> Change the operator -> "Attribute" field should not set default values.
        if( SourceAttributeList.length > 0  && ( !sourceAttributeVal.dbValue  || ctx.selected.type === 'Acp0Rule' ) ) {
            sourceAttributeVal.dbValue = SourceAttributeList[0].propInternalValue;
            sourceAttributeVal.uiValue = SourceAttributeList[0].propDisplayValue;
        }
    }
    let sourceVal = { propInternalValue:sourceAttributeVal.dbValue, propDisplayValue: sourceAttributeVal.uiValue };
    fields.sourceAttribute.setLovVal( { lovEntry:sourceVal } );
    return  {  SourceAttributeList, sourceAttributeVal };
};
/*
 * To check the selection has conditions selected.
 */
export let checkMultiSelectConds = function( ctx, data ) {
    var selectedObjects;
    var treeVMOSelecions = ctx.treeVMO ? ctx.treeVMO.selectedObjects : [];
    // In Selection model some time tree node selection not gettig correct  so handle here.
    if( treeVMOSelecions.length > 0 ) {
        selectedObjects = treeVMOSelecions;
    } else {
        selectedObjects = ctx.mselected;
    }
    ctx.condCount = 0;
    for( var selectedObject of selectedObjects ) {
        if( selectedObject.type === 'Acp0RuleCondition' ) {
            ctx.condCount += 1;
        }
    }
    return ctx.condCount;
};

/**
 *This method to make property in edit mode if there are any errors.
 *@param {Object} data of selected object
 *@param {Object} edithandler object of edit handler
 *@param {String} selectedObjectType like rule or naming convention
 */
export let setPropertyInEditMode = function( data, activeEditHandler, selectedObjectType, subPanelContext ) {
    appCtxService.updateCtx( 'editInProgress', true );
    activeEditHandler._editing = true;
    if( selectedObjectType === 'Acp0Rule' ) {
        uwPropertySvc.setIsEditable( data.acp0DefaultVarNamingConvention, true );
        uwPropertySvc.setIsEditable( data.acp0DefaultAttNamingConvention, true );
        uwPropertySvc.setIsEditable( data.acp0DefaultVisNamingConvention, true );
    }
    if( selectedObjectType === 'Acp0NamingConvention' ) {
        uwPropertySvc.setIsEditable( subPanelContext.selected.props.acp0SourceClassType, true );
        uwPropertySvc.setIsEditable( subPanelContext.selected.props.acp0SelectedAttributes, true );
        uwPropertySvc.setIsEditable( subPanelContext.selected.props.acp0delimiter, true );
        uwPropertySvc.setIsEditable( subPanelContext.selected.props.acp0NamingConvention, true );
    }
    uwPropertySvc.setIsEditable( subPanelContext.selected.props.object_desc, true );
    uwPropertySvc.setIsEditable( subPanelContext.selected.props.object_name, true );
};

/**
 * @return {selectedobject and property name}
 */
function _toGetSelectedObjectAndPropName( selectedObject ) {
    var toGetPropObject;
    var toGetPropName;
    if( selectedObject.type === 'Acp0RuleCondition' ) {
        toGetPropObject = appCtxService.ctx.pselected;
        toGetPropName = 'acp0RuleCondition';
    } else if( !selectedObject.type ) {
        toGetPropObject = cdm.getObject( selectedObject.parentNodeUid );
        toGetPropName = 'acp0Expresison';
    } else if( selectedObject.type === 'Acp0Rule' ) {
        toGetPropObject = selectedObject;
        toGetPropName = 'acp0RuleCondition';
    }
    return {
        toGetPropObject: toGetPropObject,
        toGetPropName: toGetPropName
    };
}

/*
 * Function is preparing the setProperties SOA Input
 */
function _toPrepareSetPropertiesSOAInput( requiredObject, propertyName, propertyValue ) {
    var infoInput = {
        object: '',
        timestamp: '',
        vecNameVal: [ {
            name: '',
            values: []
        } ]
    };
    infoInput.object = requiredObject;
    infoInput.vecNameVal[ 0 ].name = propertyName;
    infoInput.vecNameVal[ 0 ].values = propertyValue;
    return infoInput;
}

/**
 * @return {Object and property name}
 */
function _toGetObjectAndPropNameToAddRemoveCondsOrExps( selectedObject, data ) {
    var toGetPropName;
    var dataToBePush;
    var space = ' ';
    if( selectedObject.type === 'Acp0RuleCondition' ) {
        toGetPropName = 'acp0Expresison';
        var dataOpExist = data && selectedObject.props.acp0Expresison.dbValues.length > 0 ? data.operator : undefined;
        var operator = dataOpExist ? dataOpExist.dbValue : undefined;
        operator = operator ? operator + space : '';
        dataToBePush = data ? operator + data.sourceAttribute.dbValue + space + data.relation.uiValue + space + data.attributeValue.uiValue : data;
    } else if( selectedObject.type === 'Acp0Rule' ) {
        toGetPropName = 'acp0RuleCondition';
        dataToBePush = data ? data.createdCondObject.uid : data;
    }
    return {
        toGetPropName: toGetPropName,
        dataToBePush: dataToBePush
    };
}

/**
 *function to get lov of attribute values
 *@param {Object} selectedNCUID
 *@param {Object} propName
 *@param {String} acp0SourceClassTypeValue
*@param {Object} data
 */
function _getSourceAttLOVValues( selectedNCUID, propName, acp0SourceClassTypeValue, data ) {
    var deferred = AwPromiseService.instance.defer();
    var acp0SourceClassTypeValues = [ acp0SourceClassTypeValue ];
    var inputData = {
        initialData: {
            propertyName: propName,
            lovInput: {
                owningObject: {
                    type: 'Acp0NamingConvention',
                    uid: selectedNCUID
                },
                operationName: 'Edit',
                boName: 'Acp0NamingConvention',
                propertyValues: {}
            }
        }
    };
    if( !data && propName === 'acp0SourceClassAttribute' ) {
        inputData.initialData.lovInput.propertyValues = {
            acp0SourceClassAttribute: [],
            acp0SourceClassType: acp0SourceClassTypeValues
        };
    }
    soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', inputData ).then( function( responseData ) {
        //To set the attribute list on Add expression Panel
        if( responseData &&
                Object.keys( responseData ).length !== 0 ) {
            if( data ) {
                let newSourceAttribute = exports.getLOVList( responseData );
                return deferred.resolve( newSourceAttribute  );
            }
            if( propName === 'acp0SourceClassType' ) {
                _sourceclassList = exports.getLOVList( responseData );
                for( var sourceClass of _sourceclassList ) {
                    _acp0SourceClassTypeValues.push( sourceClass.propInternalValue );
                }
            }
            if( propName === 'acp0SourceClassAttribute' ) {
                var sourceClassAttrList = exports.getLOVList( responseData );
                for( var sourceClassAttr of sourceClassAttrList ) {
                    _mapOfPropNameDispValue.set( sourceClassAttr.propInternalValue, sourceClassAttr.propDisplayValue );
                }
            }
        }
        if( _acp0SourceClassTypeValues.length > 0 ) {
            deferred.resolve( _getSourceAttLOVValues( undefined, 'acp0SourceClassAttribute', _acp0SourceClassTypeValues.shift(), undefined ) );
        } else {
            deferred.resolve( _mapOfPropNameDispValue );
        }
    } );
    return deferred.promise;
}


/**
 * @param deferred
 * @param propertyLoadRequests
 */
function _loadProperties( deferred, propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }
            _populateColumns( propertyLoadRequest.columnInfos, true, childNode, childNode.childNdx + 1 );
            allChildNodes.push( childNode );
        } );
    } );
    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );
    var resolutionObj = {
        propertyLoadResult: propertyLoadResult
    };
    deferred.resolve( resolutionObj );
}

/**
 * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
 *            table rows.
 * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {Number} nChildren - The # of child nodes to add to the given 'parent'.
 * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
 */
function _buildTreeTableStructure( columnInfos, parentNode, nChildren, isLoadAllEnabled, i18nStrings ) {
    var children = [];
    _mapNodeId2ChildArray[ parentNode.id ] = children;
    var levelNdx = parentNode.levelNdx + 1;
    for( var childNdx = 1; childNdx <= nChildren.length; childNdx++ ) {
        /**
         * Create a new node for this level. and Create props for it
         */
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[ childNdx - 1 ], levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nStrings );
        /**
         * Add it to the 'parent' based on its ID
         */
        children.push( vmNode );
    }
}

/**
 * function to evaluate if an object contains children
 * @param {objectType} objectType object type
 * @return {boolean} if node contains child
 */
function containChildren( props, vmNode ) {
    var deferred = AwPromiseService.instance.defer();
    var containChild = false;
    var loadChxObjectInput = {
        objects: [ cdm.getObject( vmNode.uid ) ],
        attributes: [ 'acp0Expresison', 'acp0NamingConventionRef', 'acp0NamingConvention' ]
    };
    if( loadChxObjectInput.objects[ 0 ] && loadChxObjectInput.objects[ 0 ].type === 'Acp0RuleCondition' ) {
        soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', loadChxObjectInput ).then( function( getPropertiesResponse ) {
            var uid = getPropertiesResponse.plain[ 0 ];
            var ChildVMO = cdm.getObject( getPropertiesResponse.plain[ 0 ] );
            if( ChildVMO.props.acp0Expresison.dbValues.length > 0 ) {
                vmNode.isLeaf = containChild;
            } else {
                vmNode.isLeaf = !containChild;
            }
            vmNode.props = props;
            return deferred.resolve( { vmNode } );
        } );
    } else {
        vmNode.isLeaf = !containChild;
        return deferred.resolve( { vmNode } );
    }
    if( !vmNode.isLeaf ) {
        _deferExpandTreeNodeArray.push( vmNode );
    }
    return deferred.promise;
}
/**
 * @param {ObjectArray} columnInfos -
 * @param {Boolean} isLoadAllEnabled -
 * @param {ViewModelTreeNode} vmNode -
 * @param {Number} childNdx -
 */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, props ) {
    if( isLoadAllEnabled ) {
        if( !vmNode.props ) {
            vmNode.props = {};
        }
        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
            .getObject( vmNode.uid ), 'EDIT' );
        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

/**
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos( i18nStrings ) {
    var cur_location_context = appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    if( !_treeTableColumnInfos || cur_location_context !== prev_location_context ) {
        _treeTableColumnInfos = _buildTreeTableColumnInfos( i18nStrings );
        prev_location_context = cur_location_context;
    }
    return _treeTableColumnInfos;
}
/**
 * @return {width} To get dynamic Width of aw-splm-table.
 **/
function findWidth() {
    // var width = document.getElementById('toolBarWidthForCal').clientWidth;
    // width = width === 0 ? document.getElementById('noAwSplmTable').clientWidth : width;
    // width = width * 99.7 / 100;
    return 700;
}
/**
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumnInfos( i18nStrings ) {
    var columnInfos = [];
    /**
     * Set 1st column to special 'name' column to support tree-table.
     */

    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'acp0Expresison',
        displayName: i18nStrings.expressiontoolbarTitle,
        width: findWidth(),
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    for( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[ index ];
        column.cellRenderers = [];
    }
    var sortCriteria = [];
    if( !_.isEmpty( sortCriteria ) ) {
        if( sortCriteria[ 0 ].fieldName && _.eq( awColumnInfos[ 0 ].name, sortCriteria[ 0 ].fieldName ) ) {
            awColumnInfos[ 0 ].sort = {};
            awColumnInfos[ 0 ].sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
            awColumnInfos[ 0 ].sort.priority = 0;
        }
    }
    return awColumnInfos;
}

// to add newly created conditions.
export let addNewlyCreatedSiblingElement = function( data, dataProvider, treeLoadResult, selectedParentUid ) {
    if ( treeLoadResult && treeLoadResult.parentNode  ) {
        if( !selectedParentUid ) {
            selectedParentUid =  treeLoadResult.parentNode.uid;
        }
        var addElementResponse = data.addedChildOrSiblingState.addElementResponse;
        var vmc = dataProvider.viewModelCollection;
        var loadedVMOs;
        if( vmc ) {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        }
        var vmoId = vmc.findViewModelObjectById( selectedParentUid );
        var parentVMO = dataProvider.topTreeNode;
        if( vmoId > -1 ) {
            parentVMO = loadedVMOs[ vmoId ];
        }
        var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
            return vmo.uid === selectedParentUid;
        } );

        addElementResponse.levelNdx = parentVMO.levelNdx + 1;
        addElementResponse.parentUid = selectedParentUid;
        var childLevelIndex = addElementResponse.levelNdx;

        updateParentNodeState( parentVMO );

        //Add the new treeNode to the parentVMO (if one exists) children array
        var childNodes = treeLoadResult.childNodes;
        if( parentVMO && parentVMO.children ) {
            if( parentVMO.children.length === 0 ) {
                var idx = parentIdx;
                _.forEach( childNodes, function( childNode ) {
                    parentVMO.children.push( childNode );
                    loadedVMOs.splice( ++idx, 0, childNode );
                } );
            }
            parentVMO.children.push( addElementResponse );
            parentVMO.isLeaf = false;
            parentVMO.totalChildCount = parentVMO.children.length;
            var childIdx = parentIdx + parentVMO.totalChildCount;
            //See if we have any expanded children to skip over in the viewModelCollection
            var numFirstLevelChildren = 0;
            var i = 0;
            for(  i = parentIdx + 1; i < loadedVMOs.length; i++ ) {
                if( numFirstLevelChildren === childIdx && loadedVMOs[ i ].levelNdx <= childLevelIndex ) {
                    break;
                }
                if( loadedVMOs[ i ].levelNdx === childLevelIndex ) {
                    numFirstLevelChildren++;
                }
                if( loadedVMOs[ i ].levelNdx < childLevelIndex ) {
                    // no longer looking at first level children (now looking at an uncle)
                    break;
                }
            }
            var newIndex = i;
            // insert the new treeNode in the viewModelCollection at the correct location
            loadedVMOs.splice( newIndex, 0, addElementResponse );
        }
        expandSelectedNode( data, parentVMO );
        dataProvider.update( loadedVMOs );
        return{ treeLoadResult:treeLoadResult };
    }
};

export let addNewlyCreatedChildElement = function( data, dataProvider, treeLoadResult, selectedParentUid, i18nString ) {
    if ( treeLoadResult && treeLoadResult.parentNode  ) {
        var parentVMO = dataProvider.topTreeNode;

        // If condition is added then loadCondExprTreeTableData return treeLoadResult.parentNode as "top"
        // And if we try to add expressions then that exps get added into top instead of conditions
        // Therefore we are updating treeLoadResult
        if( treeLoadResult.parentNode.uid === 'top' ) {
            var children1 = [];
            var children = [];
            var selectedObjects = dataProvider.selectedObjects[0];
            parentVMO = dataProvider.selectedObjects[0];
            //treeLoadResult.parentNode = treeLoadResult.childNodes[0];
            treeLoadResult.parentNode = selectedObjects;
            var parentNode = treeLoadResult.parentNode;
            // load all expressions
            var loadChxObjectInput = {
                objects: [ cdm.getObject( parentNode.uid ) ],
                attributes: [ 'acp0Expresison' ]
            };
            var vmnodes = [];
            var levelNdx = parentNode.levelNdx + 1;
            var isLoadAllEnabled = true;
            var columnInfos = _getTreeTableColumnInfos( i18nString );
            if( loadChxObjectInput.objects[ 0 ].type === 'Acp0RuleCondition' ) {
                var ChildVMO = loadChxObjectInput.objects[ 0 ];
                var condObj = ChildVMO.props.acp0Expresison;
                if( condObj && condObj.dbValues.length > 0 ) {
                    for( var i = 0; i < condObj.dbValues.length - 1; i++ ) {
                        var temp = ChildVMO.props.acp0Expresison.dbValues[ i ];
                        children.push( temp );
                    }
                }

                for( var childNdx = 1; childNdx <= children.length; childNdx++ ) {
                    vmnodes.push( createVmNodeUsingNewObjectInfoForChildObject(  children[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode, i18nString ) );

                    // totalSiblings is use for Move Up/ Move Down command visibility
                    vmnodes[childNdx - 1].totalSiblings = children.length;
                    children1.push( vmnodes[childNdx - 1] );
                }
                treeLoadResult.childNodes = children1;
            }
        }

        if( !selectedParentUid ) {
            selectedParentUid =  treeLoadResult.parentNode.uid;
        }

        var vmc = dataProvider.viewModelCollection;
        var loadedVMOs = undefined;
        if( vmc ) {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        }
        var vmoId = vmc.findViewModelObjectById( selectedParentUid );

        if( vmoId > -1 ) {
            parentVMO = loadedVMOs[ vmoId ];
        }
        var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
            return vmo.uid === selectedParentUid;
        } );

        var childLevelIndex = parentVMO.levelNdx + 1;

        updateParentNodeState( parentVMO );

        var loadChxObjectInput = {
            objects: [ cdm.getObject( parentVMO.uid ) ],
            attributes: [ 'acp0Expresison' ]
        };
        var vmnode = undefined;
        var children = undefined;

        var columnInfos = _getTreeTableColumnInfos( i18nString );
        var isLoadAllEnabled = true;
        var levelNdx = parentVMO.levelNdx + 1;
        if( loadChxObjectInput.objects[ 0 ].type === 'Acp0RuleCondition' ) {
            var ChildVMO = loadChxObjectInput.objects[ 0 ];
            var condObj = ChildVMO.props.acp0Expresison;
            var newchildIndex = 0;
            if( condObj && condObj.dbValues.length > 0 ) {
                newchildIndex = condObj.dbValues.length;
                children = ChildVMO.props.acp0Expresison.dbValues[ newchildIndex - 1 ];
            }
            if( children !== undefined ) {
                vmnode =  createVmNodeUsingNewObjectInfoForChildObject(  children, levelNdx, newchildIndex, isLoadAllEnabled, columnInfos, parentVMO, i18nString );
            }
        }
        if( vmnode !== undefined ) {
            vmnode.parentNodeUid = parentVMO.uid;
        }
        //Add the new treeNode to the parentVMO (if one exists) children array
        var childNodes = treeLoadResult.childNodes;
        if( parentVMO && parentVMO.children ) {
            if( parentVMO.children.length === 0 ) {
                var idx = parentIdx;
                _.forEach( childNodes, function( childNode ) {
                    parentVMO.children.push( childNode );
                    loadedVMOs.splice( ++idx, 0, childNode );
                } );
            }
            parentVMO.children.push( vmnode );
            parentVMO.isLeaf = false;
            // eslint-disable-next-line max-lines
            parentVMO.totalChildCount = parentVMO.children.length;
            var childIdx = parentIdx + parentVMO.totalChildCount;
            //See if we have any expanded children to skip over in the viewModelCollection
            var numFirstLevelChildren = 0;
            var i = 0;
            for( i = parentIdx + 1; i < loadedVMOs.length; i++ ) {
                if( numFirstLevelChildren === childIdx && loadedVMOs[ i ].levelNdx <= childLevelIndex ) {
                    break;
                }
                if( loadedVMOs[ i ].levelNdx === childLevelIndex ) {
                    numFirstLevelChildren++;
                }
                if( loadedVMOs[ i ].levelNdx < childLevelIndex ) {
                    // no longer looking at first level children
                    break;
                }
            }
            var newIndex = i;

            //update totalSiblings to each expressions
            for( var index = 0; index < parentVMO.totalChildCount; index++ ) {
                parentVMO.children[index].totalSiblings = parentVMO.totalChildCount;
            }

            // insert the new treeNode in the viewModelCollection at the correct location
            loadedVMOs.splice( newIndex, 0, vmnode );
        }

        expandSelectedNode( data, parentVMO );
        dataProvider.update( loadedVMOs );
        return{ treeLoadResult:treeLoadResult };
    }
};


var updateParentNodeState = function( parentVMO ) {
    if( parentVMO ) {
        //the parent exists in the VMO lets make sure it is now marked as parent and expanded
        parentVMO.expanded = true;
        parentVMO.isExpanded = true;
        parentVMO.isLeaf = false;
        if( !parentVMO.children ) {
            parentVMO.children = [];
        }
    }
};

let addSiblingElement = function( panelContext, addElementResponse ) {
    let addedChildOrSibling = panelContext.addedChildOrSiblingState;
    let newAddedChildOrSiblingStateVal = { ...addedChildOrSibling.value };
    newAddedChildOrSiblingStateVal.addElementResponse = addElementResponse;
    newAddedChildOrSiblingStateVal.showAddChildPanel = false; // close the add child panel if open.
    newAddedChildOrSiblingStateVal.showAddSiblingPanel = false; // Ensure visibility of add sibling panel to be false.
    newAddedChildOrSiblingStateVal.addedSibling = !panelContext.addedChildOrSiblingState.addedSibling;
    panelContext.addedChildOrSiblingState.update( { ...newAddedChildOrSiblingStateVal } );
    // panelContext.addedChildOrSiblingState.addedSibling = newAddedChildOrSiblingStateVal.addedSibling;
    panelContext.addedChildOrSiblingState.value = newAddedChildOrSiblingStateVal;
};

/**
 *
 */
let addChildElement = function( panelContext ) {
    let addedChildOrSibling = panelContext.addedChildOrSiblingState;
    let newAddedChildOrSiblingStateVal = { ...addedChildOrSibling.value };
    newAddedChildOrSiblingStateVal.addElementResponse  = null;
    newAddedChildOrSiblingStateVal.showAddChildPanel = false; // close the add child panel if open.
    newAddedChildOrSiblingStateVal.showAddSiblingPanel = false; // Ensure visibility of add sibling panel to be false.
    newAddedChildOrSiblingStateVal.addedChild = !panelContext.addedChildOrSiblingState.addedChild;
    panelContext.addedChildOrSiblingState.update( { ...newAddedChildOrSiblingStateVal } );
    panelContext.addedChildOrSiblingState.addedChild = newAddedChildOrSiblingStateVal.addedChild;
    panelContext.addedChildOrSiblingState.value = newAddedChildOrSiblingStateVal;
};

/**
 * After adding expressions unders conditions then addChildInTreeTable get call.
 * This method adds exps unders conditions.
 */
export let addChildInTreeTable = function( treeLoadResult, data, dataProvider,  treeLoadInput, selectedParentUid, addElementResponse, i18nString ) {
    if ( treeLoadResult ) {
        var  retTreeLoadResult =  addNewlyCreatedChildElement( data, dataProvider, treeLoadResult, selectedParentUid,  i18nString );
        if( retTreeLoadResult ) { treeLoadResult = retTreeLoadResult.treeLoadResult; }

        return{ treeLoadResult:treeLoadResult };
    }
};

let expandSelectedNode = function( data, parentVMO ) {
    var gridId = Object.keys( data.grids )[ 0 ];
    _clearNodeState( data, gridId, parentVMO );
    awTableStateService.saveRowExpanded( data, gridId, parentVMO );
};

let _clearNodeState = function( declViewModel, gridId, targetNode ) {
    var declGrid = declViewModel._internal.grids[ gridId ];
    var uwDataProvider = declViewModel.dataProviders[ declGrid.dataProvider ];
    if( uwDataProvider.ttState && awTableStateService.isNodeExpanded( uwDataProvider.ttState, targetNode ) ) {
        delete uwDataProvider.ttState.nodeStates[ uwUtilSvc.getEvaluatedId( targetNode ) ];
    }
};


export default exports = {
    addChildInTreeTable,
    addNewlyCreatedChildElement,
    addNewlyCreatedSiblingElement,
    checkMultiSelectConds,
    createVmNodeUsingNewObjectInfo,
    getCondorExpToAdd,
    getLOVList,
    getMultipleObjDeleteMessageData,
    getRemoveExprOrCondnInfo,
    loadcondExprTreeProperties,
    loadCondExprTreeTableData,
    loadRequiredLOVValues,
    loadRequiredProperties,
    loadSourceAttributeLOVValues,
    loadTreeTableColumns,
    removeElement,
    setPropertyInEditMode,
    toMoveDownOrMoveUpTheSelCondOrExpr
};
