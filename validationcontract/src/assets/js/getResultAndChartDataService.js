// Copyright (c) 2022 Siemens

/**
 * @module js/getResultAndChartDataService
 */
import soaSvc from 'soa/kernel/soaService';
import msgSvc from 'js/messagingService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';

var exports = {};

export const updatePieChartData = ( response, subPanelContext = {} ) => {
    if ( subPanelContext.pieChartData ) {
        const newSubCtx = { ...subPanelContext.value };
        var newPieChartData = newSubCtx.pieChartData;

        if ( newPieChartData.vrTables.requirementsTableProvider && response.chartData.Requirement ) {
            newPieChartData.vrTables.requirementsTableProvider.chartData = {
                caution: response.chartData.Requirement[4],
                blocked: response.chartData.Requirement[3],
                fail: response.chartData.Requirement[2],
                pass: response.chartData.Requirement[1],
                unused: response.chartData.Requirement[0]
            };
        }

        if ( newPieChartData.vrTables.testCaseTableProvider && response.chartData.IAV0TestCase ) {
            newPieChartData.vrTables.testCaseTableProvider.chartData = {
                caution: response.chartData.IAV0TestCase[4],
                blocked: response.chartData.IAV0TestCase[3],
                fail: response.chartData.IAV0TestCase[2],
                pass: response.chartData.IAV0TestCase[1],
                unused: response.chartData.IAV0TestCase[0]
            };
        }

        if ( newPieChartData.vrTables.testProcedureTableProvider && response.chartData.IAV0TestProcedur ) {
            newPieChartData.vrTables.testProcedureTableProvider.chartData = {
                caution: response.chartData.IAV0TestProcedur[4],
                blocked: response.chartData.IAV0TestProcedur[3],
                fail: response.chartData.IAV0TestProcedur[2],
                pass: response.chartData.IAV0TestProcedur[1],
                unused: response.chartData.IAV0TestProcedur[0]
            };
        }

        if ( newPieChartData.vrTables.functionsTableProvider && response.chartData.Functionality ) {
            newPieChartData.vrTables.functionsTableProvider.chartData = {
                caution: response.chartData.Functionality[4],
                blocked: response.chartData.Functionality[3],
                fail: response.chartData.Functionality[2],
                pass: response.chartData.Functionality[1],
                unused: response.chartData.Functionality[0]
            };
        }

        if ( newPieChartData.vrTables.systemsTableProvider && response.chartData.Fnd0LogicalBlock ) {
            newPieChartData.vrTables.systemsTableProvider.chartData = {
                caution: response.chartData.Fnd0LogicalBlock[4],
                blocked: response.chartData.Fnd0LogicalBlock[3],
                fail: response.chartData.Fnd0LogicalBlock[2],
                pass: response.chartData.Fnd0LogicalBlock[1],
                unused: response.chartData.Fnd0LogicalBlock[0]
            };
        }

        if ( newPieChartData.vrTables.partsTableProvider && response.chartData.Part ) {
            newPieChartData.vrTables.partsTableProvider.chartData = {
                caution: response.chartData.Part[4],
                blocked: response.chartData.Part[3],
                fail: response.chartData.Part[2],
                pass: response.chartData.Part[1],
                unused: response.chartData.Part[0]
            };
        }

        if ( newPieChartData.vrTables.simModelTableProvider && response.chartData.CAEModel ) {
            newPieChartData.vrTables.simModelTableProvider.chartData = {
                caution: response.chartData.CAEModel[4],
                blocked: response.chartData.CAEModel[3],
                fail: response.chartData.CAEModel[2],
                pass: response.chartData.CAEModel[1],
                unused: response.chartData.CAEModel[0]
            };
        }

        if ( newPieChartData.vrTables.testMethodTableProvider && response.chartData.IAV0TestRequest ) {
            newPieChartData.vrTables.testMethodTableProvider.chartData = {
                caution: response.chartData.IAV0TestRequest[4],
                blocked: response.chartData.IAV0TestRequest[3],
                fail: response.chartData.IAV0TestRequest[2],
                pass: response.chartData.IAV0TestRequest[1],
                unused: response.chartData.IAV0TestRequest[0]
            };
        }

        if ( newPieChartData.vrTables.othersTableProvider && response.chartData.Others ) {
            newPieChartData.vrTables.othersTableProvider.chartData = {
                caution: response.chartData.Others[4],
                blocked: response.chartData.Others[3],
                fail: response.chartData.Others[2],
                pass: response.chartData.Others[1],
                unused: response.chartData.Others[0]
            };
        }
        if ( newPieChartData.vrTables.configTableOneProvider && response.chartData.ConfigTableOne ) {
            newPieChartData.vrTables.configTableOneProvider.chartData = {
                caution: response.chartData.ConfigTableOne[4],
                blocked: response.chartData.ConfigTableOne[3],
                fail: response.chartData.ConfigTableOne[2],
                pass: response.chartData.ConfigTableOne[1],
                unused: response.chartData.ConfigTableOne[0]
            };
        }
        if ( newPieChartData.vrTables.configTableTwoProvider && response.chartData.ConfigTableTwo ) {
            newPieChartData.vrTables.configTableTwoProvider.chartData = {
                caution: response.chartData.ConfigTableTwo[4],
                blocked: response.chartData.ConfigTableTwo[3],
                fail: response.chartData.ConfigTableTwo[2],
                pass: response.chartData.ConfigTableTwo[1],
                unused: response.chartData.ConfigTableTwo[0]
            };
        }
        if ( newPieChartData.vrTables.configTableThreeProvider && response.chartData.ConfigTableThree ) {
            newPieChartData.vrTables.configTableThreeProvider.chartData = {
                caution: response.chartData.ConfigTableThree[4],
                blocked: response.chartData.ConfigTableThree[3],
                fail: response.chartData.ConfigTableThree[2],
                pass: response.chartData.ConfigTableThree[1],
                unused: response.chartData.ConfigTableThree[0]
            };
        }
        if ( newPieChartData.vrTables.configTableFourProvider && response.chartData.ConfigTableFour ) {
            newPieChartData.vrTables.configTableFourProvider.chartData = {
                caution: response.chartData.ConfigTableFour[4],
                blocked: response.chartData.ConfigTableFour[3],
                fail: response.chartData.ConfigTableFour[2],
                pass: response.chartData.ConfigTableFour[1],
                unused: response.chartData.ConfigTableFour[0]
            };
        }
        if ( newPieChartData.vrTables.configTableFiveProvider && response.chartData.ConfigTableFive ) {
            newPieChartData.vrTables.configTableFiveProvider.chartData = {
                caution: response.chartData.ConfigTableFive[4],
                blocked: response.chartData.ConfigTableFive[3],
                fail: response.chartData.ConfigTableFive[2],
                pass: response.chartData.ConfigTableFive[1],
                unused: response.chartData.ConfigTableFive[0]
            };
        }
        if ( newPieChartData.vrTables.configTableSixProvider && response.chartData.ConfigTableSix ) {
            newPieChartData.vrTables.configTableSixProvider.chartData = {
                caution: response.chartData.ConfigTableSix[4],
                blocked: response.chartData.ConfigTableSix[3],
                fail: response.chartData.ConfigTableSix[2],
                pass: response.chartData.ConfigTableSix[1],
                unused: response.chartData.ConfigTableSix[0]
            };
        }
        if ( newPieChartData.vrTables.configTableSevenProvider && response.chartData.ConfigTableSeven ) {
            newPieChartData.vrTables.configTableSevenProvider.chartData = {
                caution: response.chartData.ConfigTableSeven[4],
                blocked: response.chartData.ConfigTableSeven[3],
                fail: response.chartData.ConfigTableSeven[2],
                pass: response.chartData.ConfigTableSeven[1],
                unused: response.chartData.ConfigTableSeven[0]
            };
        }
        if ( newPieChartData.vrTables.configTableEightProvider && response.chartData.ConfigTableEight ) {
            newPieChartData.vrTables.configTableEightProvider.chartData = {
                caution: response.chartData.ConfigTableEight[4],
                blocked: response.chartData.ConfigTableEight[3],
                fail: response.chartData.ConfigTableEight[2],
                pass: response.chartData.ConfigTableEight[1],
                unused: response.chartData.ConfigTableEight[0]
            };
        }
        if ( newPieChartData.vrTables.configTableNineProvider && response.chartData.ConfigTableNine ) {
            newPieChartData.vrTables.configTableNineProvider.chartData = {
                caution: response.chartData.ConfigTableNine[4],
                blocked: response.chartData.ConfigTableNine[3],
                fail: response.chartData.ConfigTableNine[2],
                pass: response.chartData.ConfigTableNine[1],
                unused: response.chartData.ConfigTableNine[0]
            };
        }
        if ( newPieChartData.vrTables.configTableTenProvider && response.chartData.ConfigTableTen ) {
            newPieChartData.vrTables.configTableTenProvider.chartData = {
                caution: response.chartData.ConfigTableTen[4],
                blocked: response.chartData.ConfigTableTen[3],
                fail: response.chartData.ConfigTableTen[2],
                pass: response.chartData.ConfigTableTen[1],
                unused: response.chartData.ConfigTableTen[0]
            };
        }
        if( newPieChartData.vrTables.softwareTableProvider && response.chartData.Software ) {
            newPieChartData.vrTables.softwareTableProvider.chartData = {
                caution: response.chartData.Software[ 4 ],
                blocked: response.chartData.Software[ 3 ],
                fail: response.chartData.Software[ 2 ],
                pass: response.chartData.Software[ 1 ],
                unused: response.chartData.Software[ 0 ]
            };
        }
        if ( newPieChartData.vrTables.topPieChart && response.chartData.TopChart ) {
            newPieChartData.vrTables.topPieChart.chartData = {
                caution: response.chartData.TopChart[4],
                blocked: response.chartData.TopChart[3],
                fail: response.chartData.TopChart[2],
                pass: response.chartData.TopChart[1],
                unused: response.chartData.TopChart[0]
            };
            if ( subPanelContext.selectionChanged ) {
                newPieChartData.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter = true;
            }
        } else {
            newPieChartData.vrTables.topPieChart = {
                chartData: {
                    caution: response.chartData.TopChart[4],
                    blocked: response.chartData.TopChart[3],
                    fail: response.chartData.TopChart[2],
                    pass: response.chartData.TopChart[1],
                    unused: response.chartData.TopChart[0]
                }
            };
        }
        if ( !newPieChartData.vrTables.callSoaOnEdit || newPieChartData.vrTables.callSoaOnEdit === false ) {
            newPieChartData.vrTables.callSoaOnEdit = true;
        }
        newSubCtx.pieChartData = newPieChartData;
        subPanelContext.update && subPanelContext.update( newSubCtx );
    }
};

export let callGetResultAndChartDataSOA = function( selectedVerificationObject, inputProxyData, additionalInfo, subPanleCtx ) {
    var pwaTreeElements = [];
    if ( subPanleCtx && subPanleCtx.context && subPanleCtx.context.vrSublocationState && subPanleCtx.context.vrSublocationState.pwaTreeElements ) {
        pwaTreeElements = subPanleCtx.context.vrSublocationState.pwaTreeElements;
    } else if ( subPanleCtx && subPanleCtx.context && subPanleCtx.context.openedObject ) {
        let pwaElement = {
            contentObject: {
                type: subPanleCtx.context.openedObject.type,
                uid: subPanleCtx.context.openedObject.uid
            },
            result: '',
            resultInfo: ''
        };
        pwaTreeElements.push( pwaElement );
    } else if( subPanleCtx.nameToken === 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation:Crt1VRSubLocationForExecute' && selectedVerificationObject ) {
        pwaTreeElements.push( selectedVerificationObject );
    }
    soaSvc.post( 'Internal-ValidationContractAW-2021-12-VCManagement', 'getResultAndChartData', {
        selectedVerificationObject: selectedVerificationObject,
        inputProxyData: inputProxyData,
        inputVerificationData: pwaTreeElements,
        additionalInfo: additionalInfo
    } ).then( function( response ) {
        exports.clientRefreshForOverridenProperty( subPanleCtx.context.vrSublocationState );
        updatePieChartData( response, subPanleCtx.context.vrSublocationState );
    }, function( response ) {
        exports.processPartialErrors( response );
    } );
};

/*
 * Calling getResultAndChartData SOA with inputProxyData and selectedVerificationObject as blank for Test Results page pie charts
 */
export let callGetResultAndChartDataSOAForResultAndExecution = function( scopeSelectionInfo, additionalInfo, subPanleCtx ) {
    soaSvc.post( 'Internal-ValidationContractAW-2021-12-VCManagement', 'getResultAndChartData', {
        selectedVerificationObject: '',
        inputProxyData: '',
        inputVerificationData: scopeSelectionInfo,
        additionalInfo: additionalInfo
    } ).then( function( response ) {
        updatePieChartDataForResultAndExecution( response, subPanleCtx );
    }, function( response ) {
        exports.processPartialErrors( response );
    } );
};

export const updatePieChartDataForResultAndExecution = ( response, subPanleCtx = {} ) => {
    if ( subPanleCtx && response && response.chartData && response.chartData.ResultChart ) {
        const newSubCtxSublocationState = { ...subPanleCtx.context.pageContext.sublocationState.value };
        newSubCtxSublocationState.resultPieChart = {};
        var newPieChartData = newSubCtxSublocationState.resultPieChart;

        newPieChartData = {
            chartData: {
                caution: response.chartData.ResultChart[4],
                blocked: response.chartData.ResultChart[3],
                fail: response.chartData.ResultChart[2],
                pass: response.chartData.ResultChart[1],
                unused: response.chartData.ResultChart[0]
            }
        };
        newSubCtxSublocationState.resultPieChart = newPieChartData;

        newSubCtxSublocationState.executionPieChart = {};
        var newPieChartData1 = newSubCtxSublocationState.executionPieChart;

        newPieChartData1 = {
            chartData: {
                inPreparation : response.chartData.ExecutionChart[11],
                ready : response.chartData.ExecutionChart[10],
                paused : response.chartData.ExecutionChart[9],
                failed: response.chartData.ExecutionChart[8],
                completed: response.chartData.ExecutionChart[7],
                warning: response.chartData.ExecutionChart[6],
                blocked: response.chartData.ExecutionChart[5],
                inProgress: response.chartData.ExecutionChart[4],
                duplicate: response.chartData.ExecutionChart[3],
                notPlanned: response.chartData.ExecutionChart[2],
                planned: response.chartData.ExecutionChart[1],
                notStarted: response.chartData.ExecutionChart[0]
            }
        };
        newSubCtxSublocationState.executionPieChart = newPieChartData1;
        subPanleCtx.context.pageContext.sublocationState && subPanleCtx.context.pageContext.sublocationState.update( newSubCtxSublocationState );
    }
};

export let processPartialErrors = function( response ) {
    if ( response.cause && response.cause.partialErrors ) {
        var msgObj = {
            msg: '',
            level: 0
        };
        if ( response && response.cause.partialErrors ) {
            _.forEach( response.cause.partialErrors, function( partialError ) {
                getMessageString( partialError.errorValues, msgObj );
            } );
        }
        msgSvc.showError( msgObj.msg );
    }
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

export let clientRefreshForOverridenProperty = function( subPanelContext ) {
    if ( subPanelContext && subPanelContext.checkBoxesInfo.length && subPanelContext.checkBoxesInfo.length > 0 ) {
        for ( var i = 0; i < subPanelContext.checkBoxesInfo.length; ++i ) {
            if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'Requirement' ) {
                eventBus.publish( 'requirementsTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'IAV0TestCase' ) {
                eventBus.publish( 'testCaseTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName ===
                'IAV0TestRequest' ) {
                eventBus.publish( 'testMethodTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName ===
                'IAV0TestProcedur' ) {
                eventBus.publish( 'testProcedureTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'Functionality' ) {
                eventBus.publish( 'functionsTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName ===
                'Fnd0LogicalBlock' ) {
                eventBus.publish( 'systemsTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'Part' ) {
                eventBus.publish( 'partsTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'CAEModel' ) {
                eventBus.publish( 'simModelTable.plTable.clientRefresh' );
            } else if ( subPanelContext.checkBoxesInfo[i] && subPanelContext.checkBoxesInfo[i].checkBoxInternalName && subPanelContext.checkBoxesInfo[i].checkBoxInternalName === 'Others' ) {
                eventBus.publish( 'othersTable.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableOne' ) {
                eventBus.publish( 'configTableOne.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableTwo' ) {
                eventBus.publish( 'configTableTwo.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableThree' ) {
                eventBus.publish( 'configTableThree.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableFour' ) {
                eventBus.publish( 'configTableFour.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableFive' ) {
                eventBus.publish( 'configTableFive.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableSix' ) {
                eventBus.publish( 'configTableSix.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableSeven' ) {
                eventBus.publish( 'configTableSeven.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableEight' ) {
                eventBus.publish( 'configTableEight.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableNine' ) {
                eventBus.publish( 'configTableNine.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName ===
                'ConfigTableTen' ) {
                eventBus.publish( 'configTableTen.plTable.clientRefresh' );
            } else if( subPanelContext.checkBoxesInfo[ i ] && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName && subPanelContext.checkBoxesInfo[ i ].checkBoxInternalName === 'Software' ) {
                eventBus.publish( 'softwareTable.plTable.clientRefresh' );
            }
        }
    }
};

export default exports = {
    callGetResultAndChartDataSOA,
    processPartialErrors,
    updatePieChartData,
    updatePieChartDataForResultAndExecution,
    clientRefreshForOverridenProperty,
    callGetResultAndChartDataSOAForResultAndExecution
};

