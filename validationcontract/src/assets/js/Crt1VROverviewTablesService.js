// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1VROverviewTablesService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import getResultAndChartDataService from 'js/getResultAndChartDataService';
import eventBus from 'js/eventBus';
import dynamicTableUtils from 'js/dynamicTableUtils';
import cmdMapSvc from 'js/commandsMapService';
import _cdm from 'soa/kernel/clientDataModel';
import { popupService } from 'js/popupService';
import selectionService from 'js/selection.service';
import editHandlerService from 'js/editHandlerService';

var exports = {};
var isMeasurementsUpdated = false;
var isSetUsageInput = false;
var isSetUsageOutput = false;
var isSetUsageUnused = false;

var getAllRows = false;
export let setGetAllRows = function( newGetllRows ) {
    getAllRows = newGetllRows;
};

/**
 *
 * _registerTableFlags
 *
 * @param {Object} checkBox checkbox
 */
function _visibleTableRows( dataProvider, subPanleCtx ) {
    var obj = [];
    var vrSublocationState = subPanleCtx.context.vrSublocationState;
    var checkBoxState = vrSublocationState.checkBoxState;
    if( checkBoxState.reqTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.sysTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.funcTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.simModelTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.tpTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.partTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.simAnalysisTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.prodAndTestTableChecked ) {
        countCheckedBoxes++;
    } else if( dataProvider.eventMap && dataProvider.eventMap.hasOwnProperty( 'Crt1ParameterTable.contentLoaded' ) ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableOneChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableTwoChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableThreeChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableFourChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableFiveChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableSixChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableSevenChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableEightChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableNineChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.configTableTenChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.othersTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.reportsTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.tcTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.tmTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.phyTableChecked ) {
        countCheckedBoxes++;
    } else if( checkBoxState.softwareTableChecked ) {
        countCheckedBoxes++;
    }

    if( dataProvider.viewModelCollection ) {
        obj = dataProvider.viewModelCollection.loadedVMObjects;
        exports.table_processOutput( dataProvider, subPanleCtx.context.vrSublocationState );
        //add new objects only if not exists in allRows
        var allRows = subPanleCtx.context.vrSublocationState.allRows;
        let rows = _.unionBy( allRows, obj, 'uid' );
        if( allRows ) {
            //Check if selected object is present in loaded object
            //If no then remove object from allRows
            if( dataProvider.selectedObjects.length > 0 && !obj.filter( function( e ) { return e.uid === dataProvider.selectedObjects[ 0 ].uid; } ).length > 0 ) {
                _.remove( rows, function( filterValue ) {
                    return filterValue.uid === dataProvider.selectedObjects[ 0 ].uid;
                } );
            }
            allRows = rows;
        } else {
            allRows = obj;
        }
        let newVrSublocationState = subPanleCtx.context.vrSublocationState.value;
        newVrSublocationState.allRows = allRows;
        subPanleCtx.context.vrSublocationState.update && subPanleCtx.context.vrSublocationState.update( newVrSublocationState );
    }
    return obj;
}
var visibleProxies = [];
let countCheckedBoxes = 0;
export let modelObjectsLoaded = function( dataProvider, eventMap, scopeSel, subPanleCtx ) {
    scopeSel = subPanleCtx.context.vrSublocationState.mselected[ 0 ];
    if( dataProvider ) {
        // Below table doesn't Hold crt1Result column. so no need to reset the column for them.
        let ignoredTablesForResultCol = dataProvider && dataProvider.name !== 'reportTableProvider' && dataProvider.name !== 'testAndProdBOMTableProvider' && dataProvider.name !==
            'testEBOMTableProvider';
        if( dataProvider && dataProvider.columnConfig && dataProvider.columnConfig.columns[ 3 ] && dataProvider.columnConfig.columns[ 3 ].propertyName !== 'crt1Result' && eventMap &&
            ignoredTablesForResultCol ) {
            _ifResultColumnMissing( eventMap );
            return;
        }
        var obj;
        obj = _visibleTableRows( dataProvider, subPanleCtx );
        let callSoa = false;
        //In case of add or remove row
        if( getAllRows ) {
            callSoa = true;
            getAllRows = false;
            exports.refreshTablesWhereChartClicked( subPanleCtx );
        }
        if( obj && obj.length ) {
            for( var i = 0; i < obj.length; i++ ) {
                //If visible proxies already contains new objects then do not add it
                if( visibleProxies.filter( function( e ) { return e.uid === obj.uid; } ).length > 0 ) {
                    continue;
                }
                visibleProxies.push( obj[ i ] );
            }
        }
        if( eventMap && !eventMap[ 'undefined.selected' ] && !eventMap[ 'undefined.unselected' ] && subPanleCtx.context.vrSublocationState.ckBoxEnabled || subPanleCtx.context.vrSublocationState
            .treeNodeExpanded ) {
            callSoa = true;
            const newSubCtx = { ...subPanleCtx.context.vrSublocationState.value };
            newSubCtx.ckBoxEnabled = false;
            newSubCtx.treeNodeExpanded = false;
            subPanleCtx.context.vrSublocationState.update && subPanleCtx.context.vrSublocationState.update( newSubCtx );
        }
        if( subPanleCtx && subPanleCtx.context.vrSublocationState.pieChartData ) {
            const newSubCtx = { ...subPanleCtx.context.vrSublocationState.value };
            var newpieChartData = newSubCtx.pieChartData;
            newpieChartData.vrTables.callSoaOnEdit = true;
            subPanleCtx.context.vrSublocationState.update && subPanleCtx.context.vrSublocationState.update( newSubCtx );
        }
        if( countCheckedBoxes === subPanleCtx.context.vrSublocationState.CountTablesLoaded ) {
            if( subPanleCtx.context.vrSublocationState.pieChartData.vrTables.topPieChart && ( subPanleCtx.context.vrSublocationState.pieChartData.vrTables.topPieChart.testResultPieClicked === true ||
                    subPanleCtx.context.vrSublocationState.pieChartData.vrTables.topPieChart.testResultPieUnClicked === true ) ) {
                countCheckedBoxes = 0;
                editHandlerService.setActiveEditHandlerContext( 'NONE' );
                if( subPanleCtx.context.vrSublocationState.pieChartData.vrTables.topPieChart.testResultPieUnClicked === true ) {
                    const newSubCtx = { ...subPanleCtx.context.vrSublocationState.value };
                    newSubCtx.pieChartData.vrTables.topPieChart.testResultPieUnClicked === false;
                    subPanleCtx.context.vrSublocationState.update && subPanleCtx.context.vrSublocationState.update( newSubCtx );
                }
                return;
            }
            // FIRE NEW SOA
            exports.getResultSOAInputForPageLoad( visibleProxies, scopeSel, subPanleCtx );
            // As page load completed, unregister all table flags and reset checkBox count and visible rows
            countCheckedBoxes = 0;
            editHandlerService.setActiveEditHandlerContext( 'NONE' );
            visibleProxies = [];
            _unregisterTableFlags( subPanleCtx );
        } else if( countCheckedBoxes === 0 || callSoa ) {
            exports.getResultSOAInputForPageLoad( visibleProxies, scopeSel, subPanleCtx );
            visibleProxies = [];
        }
    }
};

export let modelObjectEdited = function( dataProvider, scopeSel, subPanleCtx ) {
    if( dataProvider ) {
        var obj;
        obj = _visibleTableRows( dataProvider, subPanleCtx );
        scopeSel = subPanleCtx.context.vrSublocationState.mselected[ 0 ];
        //In case of edit other than Result
        if( obj && obj.length ) {
            for( var i = 0; i < obj.length; i++ ) {
                if( ( !obj[ i ].props.crt1Result || obj[ i ].props.crt1Result && obj[ i ].selected === true && !obj[ i ].props.crt1Result.newDisplayValues ) && ( !obj[ i ].props.crt1IsTarget || obj[ i ]
                    .props.crt1IsTarget && obj[ i ].selected === true && !obj[ i ].props.crt1IsTarget.newDisplayValues ) ) {
                    return;
                }
                visibleProxies = subPanleCtx.context.vrSublocationState.allRows;
            }
        }
        exports.refreshTablesWhereChartClicked( subPanleCtx );
        exports.getResultSOAInputForPageLoad( obj, scopeSel, subPanleCtx );
        visibleProxies = [];
    }
};
export const table_processOutput = ( dataProvider, subPanelContext = {} ) => {
    if( subPanelContext.pieChartData ) {
        const newpieChartData = { ...subPanelContext.value };
        var tableInfo = {
            objsLoaded: dataProvider.viewModelCollection.loadedVMObjects,
            selObj: dataProvider.selectedObjects
        };
        if( newpieChartData.pieChartData.vrTables ) {
            if( newpieChartData.pieChartData.vrTables[ dataProvider.name ] ) {
                newpieChartData.pieChartData.vrTables[ dataProvider.name ].objsLoaded = dataProvider.viewModelCollection.loadedVMObjects;
                newpieChartData.pieChartData.vrTables[ dataProvider.name ].selObj = dataProvider.selectedObjects;
            } else {
                newpieChartData.pieChartData.vrTables[ dataProvider.name ] = tableInfo;
            }
        } else {
            newpieChartData.pieChartData.vrTables = {};
            newpieChartData.pieChartData.vrTables[ dataProvider.name ] = tableInfo;
        }

        subPanelContext.update && subPanelContext.update( newpieChartData );
    }
};
export let isAttrItemUpdated = function( eventMap, scopeSel, subPanelContext, eventData ) {
    if( eventMap ) {
        var isVRRevisionObj;
        var isVRObj;
        var isParaInput;
        var isParaOutput;
        var isComplexParam;
        var updated = eventMap[ 'cdm.updated' ];
        var updatedObjects = updated.updatedObjects;

        if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState && subPanelContext.context.vrSublocationState.mselected &&
            subPanelContext.context.vrSublocationState.mselected[ 0 ] ) {
            var isReusableParamTable = subPanelContext.context.vrSublocationState.mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 &&
                ( subPanelContext.context.vrSublocationState.mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Crt0SimStudyRevision' ) > -1 ||
                    subPanelContext.context.vrSublocationState.mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1 &&
                    subPanelContext.context.vrSublocationState.mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Crt0RunRevision' ) === -1 &&
                    subPanelContext.context.vrSublocationState.mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) === -1 );
        }
        if( updatedObjects ) {
            for( var i = 0; i < updatedObjects.length; ++i ) {
                if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ) {
                    isVRRevisionObj = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Crt0VldnContract' ) > -1 ) {
                    isVRObj = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 && updatedObjects[ i ]
                    .props.att1AttrInOut.dbValues[ 0 ] === 'output' ) {
                    isParaOutput = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 && updatedObjects[ i ]
                    .props.att1AttrInOut.dbValues[ 0 ] === 'input' ) {
                    isParaInput = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].props && updatedObjects[ i ].props.att0AttributeTable && updatedObjects[ i ].props.att0AttributeTable.dbValues[ 0 ] &&
                    updatedObjects[ i ].props.att0AttributeTable.dbValues[ 0 ] !== null && updatedObjects[ i ].props.att0AttributeTable.dbValues[ 0 ] !== undefined && updatedObjects[ i ].props
                    .att0AttributeTable.dbValues[ 0 ] !== '' ) {
                    // when param is complex setting this variable true thus table is not geting reloaded in _reloadTableAfterUpdate
                    // in case of complex param we do not need to reload the table after editing. only when complex wide panel closes we reload the table
                    isComplexParam = true;
                }
                if( cmdMapSvc.isInstanceOf( 'Att1AttributeAlignmentProxy', updatedObjects[ i ].modelType ) ) {
                    isSetUsageInput = false;
                    isSetUsageOutput = false;
                    isSetUsageUnused = false;
                    if( updatedObjects[ i ].props.att1AttrInOut.dbValues[ 0 ] !== 'input' && updatedObjects[ i ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                        isSetUsageInput = true;
                    }
                    if( updatedObjects[ i ].props.att1AttrInOut.dbValues[ 0 ] !== 'output' && updatedObjects[ i ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                        isSetUsageOutput = true;
                    }
                    if( updatedObjects[ i ].props.att1AttrInOut.dbValues[ 0 ] !== 'unused' && updatedObjects[ i ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                        isSetUsageUnused = true;
                    }
                    const newObjVRState = { ...subPanelContext.context.vrSublocationState.value };
                    newObjVRState.isSetUsageInput = isSetUsageInput;
                    newObjVRState.isSetUsageOutput = isSetUsageOutput;
                    newObjVRState.isSetUsageUnused = isSetUsageUnused;
                    subPanelContext.context.vrSublocationState.update && subPanelContext.context.vrSublocationState.update( newObjVRState );
                }
            }
            _reloadTableAfterUpdate( isVRRevisionObj, isVRObj, isReusableParamTable, isParaOutput, isParaInput, isComplexParam );
        }
        if( updated && subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState && subPanelContext.context.vrSublocationState.checkBoxesInfo ) {
            const newObjVRState = { ...subPanelContext.context.vrSublocationState.value };
            newObjVRState.isSetUsageInput = isSetUsageInput;
            newObjVRState.isSetUsageOutput = isSetUsageOutput;
            newObjVRState.isSetUsageUnused = isSetUsageUnused;
            subPanelContext.context.vrSublocationState.update && subPanelContext.context.vrSublocationState.update( newObjVRState );
            for( var i = 0; i < subPanelContext.context.vrSublocationState.checkBoxesInfo.length; ++i ) {
                if( subPanelContext.context.vrSublocationState.checkBoxesInfo[ i ].checkBoxInternalName !== 'Att0MeasurableAttribute' && subPanelContext.context.vrSublocationState.checkBoxesInfo[ i ]
                    .checkBoxInternalName !== 'reports' && subPanelContext.context.vrSublocationState.checkBoxesInfo[ i ]
                    .checkBoxValue && !eventData.scope ) {
                    return;
                }
            }
            if( updatedObjects ) {
                for( var i = 0; i < updatedObjects.length; ++i ) {
                    if( updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 || updatedObjects[ i ].type === 'Att0MeasurableAttribute' || updatedObjects[ i ]
                        .type === 'Att0MeasureValue' || updatedObjects[ i ].type === 'Att1AttributeAlignmentProxy' ||
                        updatedObjects[ i ].type === 'Crt0AttributeElement' ) {
                        exports.getResultSOAInputForPageLoad( subPanelContext.context.vrSublocationState.allRows, scopeSel, subPanelContext );
                        break;
                    }
                }
            }
        }
    }
};

/**
 *
 * _reloadTableAfterUpdate
 *
 */
function _reloadTableAfterUpdate( isVRRevisionObj, isVRObj, isReusableParamTable, isParaOutput, isParaInput, isComplexParam ) {
    if( isVRRevisionObj && isVRObj ) {
        eventBus.publish( 'primaryWorkarea.reset' );
    }
    if( isReusableParamTable === false && ( isParaOutput || isParaInput ) && !isComplexParam ) {
        eventBus.publish( 'uniformParamTable.reloadTable' );
    }
    if( isReusableParamTable && isParaOutput && !isComplexParam ) {
        eventBus.publish( 'uniformParamTable.reloadTable', {
            paramTableKey: 'att1ShowOutputParametersTableKey',
            reusable: true
        } );
    }
    if( isReusableParamTable && isParaInput && !isComplexParam ) {
        eventBus.publish( 'uniformParamTable.reloadTable', {
            paramTableKey: 'att1ShowInputParametersTableKey',
            reusable: true
        } );
    }
}

export let refreshTablesWhereChartClicked = function( subPanleCtx ) {
    const newVrSublocationState = { ...subPanleCtx.context.vrSublocationState.value };
    var newpieChartData = newVrSublocationState.pieChartData;
    if( newpieChartData.vrTables && newpieChartData.vrTables.requirementsTableProvider && newpieChartData.vrTables.requirementsTableProvider.requirementPieClicked ) {
        newpieChartData.vrTables.requirementsTableProvider.requirementPieClicked = false;
        newpieChartData.vrTables.requirementsTableProvider.redrawRequirementPieAsDoubleFilter = true;
        newpieChartData.vrTables.requirementsTableProvider.reqTableColumnFilters = [];
        eventBus.publish( 'requirementsTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.functionsTableProvider && newpieChartData.vrTables.functionsTableProvider.functionPieClicked ) {
        newpieChartData.vrTables.functionsTableProvider.functionPieClicked = false;
        newpieChartData.vrTables.functionsTableProvider.redrawFunctionPieAsDoubleFilter = true;
        newpieChartData.vrTables.functionsTableProvider.functionTableColumnFilters = [];
        eventBus.publish( 'functionsTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.systemsTableProvider && newpieChartData.vrTables.systemsTableProvider.systemPieClicked ) {
        newpieChartData.vrTables.systemsTableProvider.systemPieClicked = false;
        newpieChartData.vrTables.systemsTableProvider.redrawSystemPieAsDoubleFilter = true;
        newpieChartData.vrTables.systemsTableProvider.sysTableColumnFilters = [];
        eventBus.publish( 'systemsTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.testCaseTableProvider && newpieChartData.vrTables.testCaseTableProvider.testCasePieClicked ) {
        newpieChartData.vrTables.testCaseTableProvider.testCasePieClicked = false;
        newpieChartData.vrTables.testCaseTableProvider.redrawTestCasePieAsDoubleFilter = true;
        newpieChartData.vrTables.testCaseTableProvider.testCaseTreeTableColumnFilters = [];
        eventBus.publish( 'testCaseTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.simModelTableProvider && newpieChartData.vrTables.simModelTableProvider.simModelPieClicked ) {
        newpieChartData.vrTables.simModelTableProvider.simModelPieClicked = false;
        newpieChartData.vrTables.simModelTableProvider.redrawSimModelPieAsDoubleFilter = true;
        newpieChartData.vrTables.simModelTableProvider.simModelTableColumnFilters = [];
        eventBus.publish( 'simModelTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.simAnalysisTableProvider && newpieChartData.vrTables.simAnalysisTableProvider.simAnalysisPieClicked ) {
        newpieChartData.vrTables.simAnalysisTableProvider.simAnalysisPieClicked = false;
        newpieChartData.vrTables.simAnalysisTableProvider.redrawSimAnalysisPieAsDoubleFilter = true;
        newpieChartData.vrTables.simAnalysisTableProvider.simAnalysisTableColumnFilters = [];
        eventBus.publish( 'simAnalysisTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.partsTableProvider && newpieChartData.vrTables.partsTableProvider.partsPieClicked ) {
        newpieChartData.vrTables.partsTableProvider.partsPieClicked = false;
        newpieChartData.vrTables.partsTableProvider.redrawPartsPieAsDoubleFilter = true;
        newpieChartData.vrTables.partsTableProvider.partsTableColumnFilters = [];
        eventBus.publish( 'partsTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.othersTableProvider && newpieChartData.vrTables.othersTableProvider.othersPieClicked ) {
        newpieChartData.vrTables.othersTableProvider.othersPieClicked = false;
        newpieChartData.vrTables.othersTableProvider.redrawOthersPieAsDoubleFilter = true;
        newpieChartData.vrTables.othersTableProvider.othersTableColumnFilters = [];
        eventBus.publish( 'othersTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableOneProvider && newpieChartData.vrTables.configTableOneProvider.configTableOnePieClicked ) {
        newpieChartData.vrTables.configTableOneProvider.configTableOnePieClicked = false;
        newpieChartData.vrTables.configTableOneProvider.redrawConfigTableOnePieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableOneProvider.configTableOneColumnFilters = [];
        eventBus.publish( 'configTableOne.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableTwoProvider && newpieChartData.vrTables.configTableTwoProvider.configTableTwoPieClicked ) {
        newpieChartData.vrTables.configTableTwoProvider.configTableTwoPieClicked = false;
        newpieChartData.vrTables.configTableTwoProvider.redrawConfigTableTwoPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableTwoProvider.configTableTwoColumnFilters = [];
        eventBus.publish( 'configTableTwo.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableThreeProvider && newpieChartData.vrTables.configTableThreeProvider.configTableThreePieClicked ) {
        newpieChartData.vrTables.configTableThreeProvider.configTableThreePieClicked = false;
        newpieChartData.vrTables.configTableThreeProvider.redrawConfigTableThreePieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableThreeProvider.configTableThreeColumnFilters = [];
        eventBus.publish( 'configTableThree.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableFourProvider && newpieChartData.vrTables.configTableFourProvider.configTableFourPieClicked ) {
        newpieChartData.vrTables.configTableFourProvider.configTableFourPieClicked = false;
        newpieChartData.vrTables.configTableFourProvider.redrawConfigTableFourPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableFourProvider.configTableFourColumnFilters = [];
        eventBus.publish( 'configTableFour.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableFiveProvider && newpieChartData.vrTables.configTableFiveProvider.configTableFivePieClicked ) {
        newpieChartData.vrTables.configTableFiveProvider.configTableFivePieClicked = false;
        newpieChartData.vrTables.configTableFiveProvider.redrawConfigTableFivePieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableFiveProvider.configTableFiveColumnFilters = [];
        eventBus.publish( 'configTableFive.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableSixProvider && newpieChartData.vrTables.configTableSixProvider.configTableSixPieClicked ) {
        newpieChartData.vrTables.configTableSixProvider.configTableSixPieClicked = false;
        newpieChartData.vrTables.configTableSixProvider.redrawConfigTableSixPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableSixProvider.configTableSixColumnFilters = [];
        eventBus.publish( 'configTableSix.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableSevenProvider && newpieChartData.vrTables.configTableSevenProvider.configTableSevenPieClicked ) {
        newpieChartData.vrTables.configTableSevenProvider.configTableSevenPieClicked = false;
        newpieChartData.vrTables.configTableSevenProvider.redrawConfigTableSevenPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableSevenProvider.configTableSevenColumnFilters = [];
        eventBus.publish( 'configTableSeven.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableEightProvider && newpieChartData.vrTables.configTableEightProvider.configTableEightPieClicked ) {
        newpieChartData.vrTables.configTableEightProvider.configTableEightPieClicked = false;
        newpieChartData.vrTables.configTableEightProvider.redrawConfigTableEightPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableEightProvider.configTableEightColumnFilters = [];
        eventBus.publish( 'configTableEight.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableNineProvider && newpieChartData.vrTables.configTableNineProvider.configTableNinePieClicked ) {
        newpieChartData.vrTables.configTableNineProvider.configTableNinePieClicked = false;
        newpieChartData.vrTables.configTableNineProvider.redrawConfigTableNinePieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableNineProvider.configTableNineColumnFilters = [];
        eventBus.publish( 'configTableNine.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.configTableTenProvider && newpieChartData.vrTables.configTableTenProvider.configTableTenPieClicked ) {
        newpieChartData.vrTables.configTableTenProvider.configTableTenPieClicked = false;
        newpieChartData.vrTables.configTableTenProvider.redrawConfigTableTenPieAsDoubleFilter = true;
        newpieChartData.vrTables.configTableTenProvider.configTableTenColumnFilters = [];
        eventBus.publish( 'configTableTen.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.softwareTableProvider && newpieChartData.vrTables.softwareTableProvider.softwarePieClicked ) {
        newpieChartData.vrTables.softwareTableProvider.softwarePieClicked = false;
        newpieChartData.vrTables.softwareTableProvider.redrawSoftwareTablePieAsDoubleFilter = true;
        newpieChartData.vrTables.softwareTableProvider.softwareTableColumnFilter = [];
        eventBus.publish( 'softwareTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.testProcedureTableProvider && newpieChartData.vrTables.testProcedureTableProvider.testProcedurePieClicked ) {
        newpieChartData.vrTables.testProcedureTableProvider.testProcedurePieClicked = false;
        newpieChartData.vrTables.testProcedureTableProvider.redrawTestProcedurePieAsDoubleFilter = true;
        newpieChartData.vrTables.testProcedureTableProvider.testProcedureTreeTableColumnFilters = [];
        eventBus.publish( 'testProcedureTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.testMethodTableProvider && newpieChartData.vrTables.testMethodTableProvider.testMethodPieClicked ) {
        newpieChartData.vrTables.testMethodTableProvider.testMethodPieClicked = false;
        newpieChartData.vrTables.testMethodTableProvider.redrawTestMethodPieAsDoubleFilter = true;
        newpieChartData.vrTables.testMethodTableProvider.testMethodTreeTableColumnFilters = [];
        eventBus.publish( 'testMethodTable.plTable.reload' );
    }
    if( newpieChartData.vrTables && newpieChartData.vrTables.topPieChart && newpieChartData.vrTables.topPieChart.testResultPieClicked ) {
        newpieChartData.vrTables.topPieChart.testResultPieClicked = false;
        newpieChartData.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter = true;
        newpieChartData.vrTables.topPieChart.testResultColumnFilters = [];
        eventBus.publish( 'requirementsTable.plTable.reload' );
        eventBus.publish( 'functionsTable.plTable.reload' );
        eventBus.publish( 'systemsTable.plTable.reload' );
        eventBus.publish( 'testCaseTable.plTable.reload' );
        eventBus.publish( 'simModelTable.plTable.reload' );
        eventBus.publish( 'simAnalysisTable.plTable.reload' );
        eventBus.publish( 'partsTable.plTable.reload' );
        eventBus.publish( 'othersTable.plTable.reload' );
        eventBus.publish( 'testProcedureTable.plTable.reload' );
        eventBus.publish( 'testMethodTable.plTable.reload' );
        eventBus.publish( 'configTableOne.plTable.reload' );
        eventBus.publish( 'configTableTwo.plTable.reload' );
        eventBus.publish( 'configTableThree.plTable.reload' );
        eventBus.publish( 'configTableFour.plTable.reload' );
        eventBus.publish( 'configTableFive.plTable.reload' );
        eventBus.publish( 'configTableSix.plTable.reload' );
        eventBus.publish( 'configTableSeven.plTable.reload' );
        eventBus.publish( 'configTableEight.plTable.reload' );
        eventBus.publish( 'configTableNine.plTable.reload' );
        eventBus.publish( 'configTableTen.plTable.reload' );
        eventBus.publish( 'softwareTable.plTable.reload' );
    }
    newVrSublocationState.pieChartData = newpieChartData;
    subPanleCtx.context.vrSublocationState && subPanleCtx.context.vrSublocationState.update( newVrSublocationState );
};

/**
 *
 * _registerTableFlags
 *
 * @param {Object} checkBox checkbox
 */
function _unregisterTableFlags( subPanleCtx ) {
    const vrSublocationState = subPanleCtx.context.vrSublocationState;
    var vrContext = vrSublocationState.checkBoxState;
    if( vrContext ) {
        vrContext.reqTableChecked = false;
        vrContext.sysTableChecked = false;
        vrContext.funcTableChecked = false;
        vrContext.simModelTableChecked = false;
        vrContext.paraTableChecked = false;
        vrContext.simAnalysisTableChecked = false;
        vrContext.phyTableChecked = false;
        vrContext.prodAndTestTableChecked = false;
        vrContext.tmTableChecked = false;
        vrContext.tpTableChecked = false;
        vrContext.tcTableChecked = false;
        vrContext.othersTableChecked = false;
        vrContext.reportsTableChecked = false;
        vrContext.partTableChecked = false;
        vrContext.configTableOneChecked = false;
        vrContext.configTableTwoChecked = false;
        vrContext.configTableThreeChecked = false;
        vrContext.configTableFourChecked = false;
        vrContext.configTableFiveChecked = false;
        vrContext.configTableSixChecked = false;
        vrContext.configTableSevenChecked = false;
        vrContext.configTableEightChecked = false;
        vrContext.configTableNineChecked = false;
        vrContext.configTableTenChecked = false;
        vrContext.softwareTableChecked = false;
        vrSublocationState.checkBoxState = vrContext;
        vrSublocationState.update && vrSublocationState.update( vrSublocationState );
    }
}

export let unRegisterFlagAndCountOnTabShift = function( subPanleCtx ) {
    countCheckedBoxes = 0;
    _unregisterTableFlags( subPanleCtx );
};

export let getResultSOAInputForPageLoad = function( visibleProxies, scopeSel, subPanleCtx ) {
    var inputProxyData = [];
    let vrContext = appCtxSvc.getCtx( 'vrContext' );
    let scopeObjects = [];
    scopeSel = subPanleCtx.context.vrSublocationState.mselected[ 0 ];
    let scopeTreeObjects = subPanleCtx.context.vrSublocationState.mselected;
    //Current selection in scope tree should be sent at first position
    scopeObjects.push( scopeSel );
    //Skip the currently selected object from scope tree objects as its already there at first position
    if( scopeTreeObjects.length > 1 ) {
        for( let j = 0; j < scopeTreeObjects.length; j++ ) {
            if( scopeSel.uid !== scopeTreeObjects[ j ].uid ) {
                scopeObjects.push( scopeTreeObjects[ j ] );
            }
        }
    }
    if( visibleProxies && visibleProxies.length > 0 ) {
        for( var i = 0; i < visibleProxies.length; i++ ) {
            if( visibleProxies && visibleProxies[ i ] && visibleProxies[ i ].modelType &&
                visibleProxies[ i ].modelType.typeHierarchyArray && visibleProxies[ i ].modelType.typeHierarchyArray.indexOf( 'Crt1VRContentProxy' ) > -1 ) {
                var inputProxyDataObj = {};
                inputProxyDataObj.contentObject = {
                    type: visibleProxies[ i ].type,
                    uid: visibleProxies[ i ].uid
                };
                inputProxyDataObj.result = '';
                inputProxyDataObj.resultInfo = '';
                inputProxyData.push( inputProxyDataObj );
            }
        }
    }

    var additionalInfo = {
        key: []
    };

    let scopeSelectionInfo = {
        contentObject: {
            type: subPanleCtx.selection[ 0 ].type,
            uid: subPanleCtx.selection[ 0 ].uid
        },
        result: '',
        resultInfo: ''
    };
    getResultAndChartDataService.callGetResultAndChartDataSOA( scopeSelectionInfo, inputProxyData, additionalInfo, subPanleCtx );
};
export let getFilterStringForDynamicTables = function( subPanelContext ) {
    var string = '';

    if( subPanelContext && subPanelContext.checkBoxesInfo.length && subPanelContext.checkBoxesInfo.length > 0 ) {
        for( var i = 0; i < subPanelContext.checkBoxesInfo.length; ++i ) {
            if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'Requirement' ) {
                string = string.concat( 'Requirement Revision:RequirementSpec Revision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'IAV0TestCase' ) {
                string = string.concat( 'IAV0TestCaseRevision:IAV0TestStepRevision:IAV0AbsReqmtRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'IAV0TestRequest' ) {
                string = string.concat( 'IAV0TestRequestRevision:IAV0AbsReqmtRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'IAV0TestProcedur' ) {
                string = string.concat( 'IAV0TestProcedurRevision:IAV0TestStepRevision:IAV0TestCondRevision:IAV0MeasureReqmtRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'Functionality' ) {
                string = string.concat( 'FunctionalityRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'Fnd0LogicalBlock' ) {
                string = string.concat( 'Fnd0LogicalBlockRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'Part' ) {
                string = string.concat( 'AllPart Revision:AllDesign Revision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'CAEModel' ) {
                string = string.concat( 'CAEModelRevision:CAE01DModelRevision:CAE0MDOTemplateRevision:Bhm0CollectionRevision:Bhv0ModelCollection', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'PhysicalPart' ) {
                string = string.concat( 'PhysicalPartRevision', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'Att0MeasurableAttribute' ) {
                string = string.concat( 'Att0MeasurableAttribute', ':' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'Software' ) {
                string = string.concat( 'Software Revision', ':' );
            }
        }
        if( string.endsWith( ':' ) ) {
            string = string.slice( 0, string.length - 1 );
        }
    }
    return string;
};

export let getColumnFiltersForDynamicTables = function( columnProvider, tableColumnFilters, testResultColumnFilters ) {
    var columnFilters = columnProvider.columnFilters;
    if( columnFilters && columnFilters.length > 0 ) {
        columnFilters = columnProvider.columnFilters;
    } else if( tableColumnFilters && tableColumnFilters.length > 0 ) {
        columnFilters = tableColumnFilters;
    } else if( testResultColumnFilters ) {
        columnFilters = testResultColumnFilters;
    } else {
        columnFilters = [];
    }
    return columnFilters;
};

export let getColumnDataForDynamicTables = function( data ) {
    var columnConfig = data.columnConfig;
    if( !columnConfig ) {
        columnConfig = data.columnConfigurations[ 0 ].columnConfigurations[ 0 ];
    }
    var originalColumns = columnConfig.columns;
    dynamicTableUtils.addExtraColumn( originalColumns );
    if( data.columnConfig ) {
        return columnConfig;
    }
    return data.columnConfigurations;
};
export let getColumnDataForIssuesAttachmentsTables = function( data ) {
    var columnConfig = data.columnConfig;
    if( !columnConfig ) {
        columnConfig = data.columnConfigurations[ 0 ].columnConfigurations[ 0 ];
    }
    if( data.columnConfig ) {
        return columnConfig;
    }
    return data.columnConfigurations;
};
export let updateCtxForTreeNodeExpand = function( subPanelContext ) {
    const newVrSublocationState = { ...subPanelContext.context.vrSublocationState.value };
    newVrSublocationState.treeNodeExpanded = true;
    subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.update && subPanelContext.context.vrSublocationState.update( newVrSublocationState );
};
export let redrawSecondaryPieCharts = function( data ) {
    var arrayOfSeriesDataForChart = [];
    var dummyValuesForFirstSeries = [];
    var keyValueDataForChart = [];
    var displayLabels = [];

    dummyValuesForFirstSeries = [ -1, -1, -1, -1, -1 ]; // values of pie chart
    if( data.i18n ) {
        displayLabels = [ data.i18n.NoResult, data.i18n.Fail, data.i18n.Pass, data.i18n.Blocked, data.i18n.Caution ];
    }
    for( var j = 0; j < dummyValuesForFirstSeries.length; j++ ) {
        keyValueDataForChart.push( {
            label: displayLabels[ j ],
            value: dummyValuesForFirstSeries[ j ],
            name: displayLabels[ j ],
            y: dummyValuesForFirstSeries[ j ]
        } );
    }

    arrayOfSeriesDataForChart.push( {
        seriesName: data.i18n.TestResult,
        colorByPoint: true,
        keyValueDataForChart: keyValueDataForChart
    } );

    return arrayOfSeriesDataForChart;
};
export let removePieChartData = function( chartProp, table, pieClickedFlag, pieDedrawFlag, subPanleCtx, dataProvider ) {
    if( chartProp && chartProp.value ) {
        const newChartProp = { ...chartProp.value };
        if( newChartProp.vrTables && newChartProp.vrTables[ table ] ) {
            const newTableChartProp = newChartProp.vrTables[ table ];
            if( newTableChartProp[ pieClickedFlag ] ) {
                newTableChartProp[ pieClickedFlag ] = false;
            }
            if( newTableChartProp[ pieDedrawFlag ] ) {
                newTableChartProp[ pieDedrawFlag ] = false;
            }
            chartProp.update && chartProp.update( newChartProp );
        }
    }
    if( dataProvider.selectedObjects.length > 0 ) {
        dataProvider.selectedObjects = [];
        exports.handleSelectionChange( dataProvider, subPanleCtx );
    }
};

export let handleSelectionChange = function( tableProvider, subPanelContext ) {
    var objectToOpen;
    var array = [];
    var selectionUid = '';
    var selection;
    var objUid;
    var object;
    if( tableProvider && tableProvider.selectedObjects && tableProvider.selectedObjects.length === 1 ) {
        selectionUid = tableProvider.selectedObjects[ 0 ].props.crt1SourceObject.dbValue;
        selection = _cdm.getObject( selectionUid );
    } else if( tableProvider && tableProvider.selectedObjects && tableProvider.selectedObjects.length > 1 ) {
        for( var i = 0; i < tableProvider.selectedObjects.length; i++ ) {
            objUid = tableProvider.selectedObjects[ i ].props.crt1SourceObject.dbValue;
            object = _cdm.getObject( objUid );
            array.push( object );
        }
    } else if( subPanelContext && subPanelContext.selected && subPanelContext.selected.uid ) {
        selectionUid = subPanelContext.selected.uid;
        selection = _cdm.getObject( selectionUid );
    } else if( subPanelContext && subPanelContext.context && subPanelContext.context.baseSelection && subPanelContext.context.baseSelection.uid ) {
        selectionUid = subPanelContext.context.baseSelection.uid;
        selection = _cdm.getObject( selectionUid );
    }

    if( selection && selection.props && selection.props.awb0UnderlyingObject && selection.props.awb0UnderlyingObject.dbValues ) {
        objectToOpen = selection.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        objectToOpen = selectionUid;
    }
    if( selection ) {
        selection.objectToOpen = objectToOpen;
        array.push( selection );
    }
    //updating ctx.selected as Info panel reads data from ctx.selected
    var parentSelection;
    var selection = selectionService.getSelection();
    if( selection.parent ) {
        parentSelection = selection.parent;
    }
    if( array.length > 0 ) {
        selectionService.updateSelection( array, parentSelection );
    }
    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.value ) {
        const tmpSelectionData = { ...subPanelContext.selectionData.value };
        tmpSelectionData.selected = array;
        subPanelContext.selectionData.update( tmpSelectionData );
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.refreshPreviewPanel ) {
        eventBus.publish( 'refreshPreviewPanel' );
    }
};

export let refreshPreviewPanel = function( data, subPanelContext ) {
    var popupData = {
        declView: 'Crt1ShowPreview',
        locals: {
            anchor: 'previewPanel_anchor',
            caption: data.i18n.Preview
        },
        options: {
            clickOutsideToClose: false,
            present: 'modal',
            height: 700,
            width: 600,
            draggable: true,
            isModal: false,
            placement: 'left-end',
            reference: '.aw-layout-infoCommandbar',
            detachMode: true,
            subPanelContext: subPanelContext
        }
    };
    popupService.show( popupData );
};

export let updateRefreshPreviewFlagOnClose = function( vrSublocationState ) {
    if( vrSublocationState && vrSublocationState.value ) {
        const newvrSublocationStateData = { ...vrSublocationState.value };
        newvrSublocationStateData.refreshPreviewPanel = false;
        vrSublocationState.update && vrSublocationState.update( newvrSublocationStateData );
    }
};

export let updateRefreshPreviewFlagOnOpen = function( vrSublocationState ) {
    if( vrSublocationState && vrSublocationState.value ) {
        const newvrSublocationStateData = { ...vrSublocationState.value };
        newvrSublocationStateData.refreshPreviewPanel = true;
        vrSublocationState.update && vrSublocationState.update( newvrSublocationStateData );
    }
};

export let getParentUid = function( subPanelContext ) {
    var parentUid;
    if( subPanelContext && subPanelContext.selection && subPanelContext.selection[ 0 ] ) {
        parentUid = subPanelContext.selection[ 0 ].uid;
    }
    return parentUid;
};
export let measurementsUpdated = function() {
    isMeasurementsUpdated = true;
};
export let removeSelectionIfany = function( subPanleCtx, dataProvider ) {
    if( dataProvider.selectedObjects.length > 0 ) {
        dataProvider.selectedObjects = [];
        exports.handleSelectionChange( dataProvider, subPanleCtx );
    }
};

// getIssuesAndAttachment for execute
export let getIssuesAndAttachment = function( subPanelContext ) {
    var selectedUids;
    if( subPanelContext && subPanelContext.treeNodeUid ) {
        selectedUids = subPanelContext.treeNodeUid.uid;
    } else if( subPanelContext && subPanelContext.selection[ 0 ] ) {
        selectedUids = subPanelContext.selection[ 0 ].uid;
    }
    return selectedUids;
};

function _ifResultColumnMissing( eventMap ) {
    if( eventMap.columnArrange.name === 'requirementsTable' ) {
        eventBus.publish( 'requirementsTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'functionsTable' ) {
        eventBus.publish( 'functionsTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'systemsTable' ) {
        eventBus.publish( 'systemsTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'partsTable' ) {
        eventBus.publish( 'partsTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'simModelTable' ) {
        eventBus.publish( 'simModelTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'softwareTable' ) {
        eventBus.publish( 'softwareTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableOne' ) {
        eventBus.publish( 'configTableOne.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableTwo' ) {
        eventBus.publish( 'configTableTwo.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableThree' ) {
        eventBus.publish( 'configTableThree.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableFour' ) {
        eventBus.publish( 'configTableFour.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableFive' ) {
        eventBus.publish( 'configTableFive.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableSix' ) {
        eventBus.publish( 'configTableSix.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableSeven' ) {
        eventBus.publish( 'configTableSeven.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableEight' ) {
        eventBus.publish( 'configTableEight.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableNine' ) {
        eventBus.publish( 'configTableNine.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'configTableTen' ) {
        eventBus.publish( 'configTableTen.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'testMethodTable' ) {
        eventBus.publish( 'testMethodTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'testCaseTable' ) {
        eventBus.publish( 'testCaseTable.plTable.reload' );
    } else if( eventMap.columnArrange.name === 'testProcedureTable' ) {
        eventBus.publish( 'testProcedureTable.plTable.reload' );
    }
}

export default exports = {
    modelObjectsLoaded,
    unRegisterFlagAndCountOnTabShift,
    getResultSOAInputForPageLoad,
    modelObjectEdited,
    refreshTablesWhereChartClicked,
    isAttrItemUpdated,
    getFilterStringForDynamicTables,
    getColumnFiltersForDynamicTables,
    getColumnDataForDynamicTables,
    updateCtxForTreeNodeExpand,
    table_processOutput,
    redrawSecondaryPieCharts,
    removePieChartData,
    handleSelectionChange,
    refreshPreviewPanel,
    updateRefreshPreviewFlagOnClose,
    updateRefreshPreviewFlagOnOpen,
    getParentUid,
    setGetAllRows,
    measurementsUpdated,
    getColumnDataForIssuesAttachmentsTables,
    removeSelectionIfany,
    getIssuesAndAttachment
};
