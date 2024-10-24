// Copyright (c) 2022 Siemens

/**
 * @module propRenderTemplates/Crt1ParameterResultStatus
 */
import app from 'app';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import { getBaseUrlPath } from 'app';
import dmSvc from 'soa/dataManagementService';

var exports = {};

/**
 * Generates Parameter Result Status DOM Element
 * @param { Object } vmo - ViewModelObject for which parameter result status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which parameter result status will be rendered
 */
export let parameterResultStatusFn = function( vmo, containerElem ) {
    var result = null;
    var resultForCrt0Result = null;
    var inOut = null;
    if( appCtxService.ctx.xrtSummaryContextObject &&
        appCtxService.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ||
        appCtxService.ctx.openedARObject &&
        appCtxService.ctx.openedARObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 || appCtxService.ctx.state && appCtxService.ctx.state.processed && appCtxService.ctx
        .state.processed.spageId &&
        appCtxService.ctx.state.processed.spageId === 'Crt1ShowPlanTable' ||
        appCtxService.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        if( vmo.props && vmo.props.att1Result && vmo.props.att1Result.dbValue ) {
            result = vmo.props.att1Result.dbValue;
        }
        if( vmo.props && vmo.props.att1AttrContext && vmo.props.att1AttrContext.dbValue ) {
            var attrContext = vmo.props.att1AttrContext.dbValue;
            if (attrContext) {
                var attrContextModelObject = cdm.getObject(attrContext);

                if (attrContextModelObject &&
                    attrContextModelObject.props &&
                    attrContextModelObject.props.crt0Result &&
                    attrContextModelObject.props.crt0Result.dbValues) {
                    resultForCrt0Result = attrContextModelObject.props.crt0Result.dbValues[0];
                } else if (result) {
                    dmSvc.getPropertiesUnchecked([attrContextModelObject], ['crt0Result']).then(function (response) {
                        parameterResultStatusFn(vmo, containerElem);
                    });
                    return;
                }
            }
        }
        if( vmo.props && vmo.props.att1AttrInOut && vmo.props.att1AttrInOut.dbValue ) {
            inOut = vmo.props.att1AttrInOut.dbValue;
        }

        var color = document.createElement( 'div' );
        color.className = 'aw-visual-indicator';
        color.style.backgroundSize = '500px 500px';
        var colorSrc = null;

        if( inOut === 'output' && result === '100' && resultForCrt0Result === '100' ) {
            color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
            colorSrc = '#50bed7';
            color.style.width = '43px';
            color.style.textAlign = 'center';
            color.style.color = 'white';
            color.title = 'Result Overridden';
        } else if( inOut === 'output' && result === '200' && resultForCrt0Result === '200' ) {
            color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
            colorSrc = '#50bed7';
            color.style.width = '43px';
            color.style.textAlign = 'center';
            color.style.color = 'white';
            color.title = 'Result Overridden';
        } else if( inOut === 'output' && result === '100' ) {
            color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
            colorSrc = '#DC0000';
            color.style.width = '43px';
            color.style.textAlign = 'center';
            color.style.color = 'white';
        } else if( inOut === 'output' && result === '200' ) {
            color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
            colorSrc = '#0A9B00';
            color.style.width = '43px';
            color.style.textAlign = 'center';
            color.style.color = 'white';
        }
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    }
};

export let resultStatusFn = function( vmo, containerElem ) {
    var crt1Result = null;
    var crt0Result = null;
    var resultDisplayValue = null;

    //Get Object of Validation Link to access crt0IsResultOverriden property
    if( vmo && vmo.props && vmo.props.crt1ValidationLink && vmo.props.crt1ValidationLink.dbValue ) {
        var validationLink = vmo.props.crt1ValidationLink.dbValue;
        var ValidationObj = cdm.getObject( validationLink );
    }

    //For Content proxy objects
    if( vmo.type === 'Crt1VRContentProxy' && vmo.props && vmo.props.crt1ValidationLink && vmo.props.crt1ValidationLink.dbValue && vmo.props.crt1Result &&
        vmo.props.crt1Result.displayValues[ 0 ] !== undefined ) {
        var validationLink = vmo.props.crt1ValidationLink.dbValue;
        var object = cdm.getObject( validationLink );
        if( object && object.props && object.props.crt0Result && object.props.crt0Result.dbValues[ 0 ] !== undefined ) {
            // In TC13.2 cell colour not coming, as client throws exception here. Anyway this property evalution is not needed in TC13.2 so adding safe check
            crt0Result = object.props.crt0Result.dbValues[ 0 ];
        }
        crt1Result = vmo.props.crt1Result.dbValue;
        resultDisplayValue = vmo.props.crt1Result.displayValues[ 0 ];
    } else if( vmo.props && vmo.props.crt0Result && vmo.props.crt0Result.dbValue && vmo.props.crt0Result.displayValues[ 0 ] !== undefined ) {
        //For VR sub-types, Trends tab(Study,TR etc.)
        crt1Result = vmo.props.crt0Result.dbValue;
        resultDisplayValue = vmo.props.crt0Result.displayValues[ 0 ];
    }

    var color = document.createElement( 'div' );
    color.className = 'aw-visual-indicator';
    color.style.backgroundSize = '500px 500px';
    var colorSrc = null;
    // For updating result column with icon for execute
    if( appCtxService.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        if( crt1Result === '200' ) {
            let imagePath = getBaseUrlPath() + '/image/indicatorApprovedPass16.svg';
            var celRequiredImg = document.createElement( 'img' );
            celRequiredImg.className = 'aw-visual-indicator';
            celRequiredImg.src = imagePath;
            containerElem.appendChild( celRequiredImg );
        } else if( crt1Result === '100' ) {
            let imagePath = getBaseUrlPath() + '/image/indicatorNo16.svg';
            var celRequiredImg = document.createElement( 'img' );
            celRequiredImg.className = 'aw-visual-indicator';
            celRequiredImg.src = imagePath;
            containerElem.appendChild( celRequiredImg );
        }else if( crt1Result === '400' ) {
            let imagePath = getBaseUrlPath() + '/image/indicatorCross16.svg';
            var celRequiredImg = document.createElement( 'img' );
            celRequiredImg.className = 'aw-visual-indicator';
            celRequiredImg.src = imagePath;
            containerElem.appendChild( celRequiredImg );
        }else if( crt1Result === '500' ) {
            let imagePath = getBaseUrlPath() + '/image/indicatorWarning16.svg';
            var celRequiredImg = document.createElement( 'img' );
            celRequiredImg.className = 'aw-visual-indicator';
            celRequiredImg.src = imagePath;
            containerElem.appendChild( celRequiredImg );
        }
    } else if( appCtxService.ctx.tcSessionData.tcMajorVersion >= 14 && appCtxService.ctx.tcSessionData.tcMinorVersion >= 1 && ( crt1Result === '100' || crt1Result === '200' ) &&
        ( ValidationObj && ValidationObj.props && ValidationObj.props.crt0IsResultOverriden && ValidationObj.props.crt0IsResultOverriden.dbValues[ 0 ] === '1' ) ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#50bed7';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    } else if( ( appCtxService.ctx.tcSessionData.tcMajorVersion === 14 && appCtxService.ctx.tcSessionData.tcMinorVersion === 0 || appCtxService.ctx.tcSessionData.tcMajorVersion < 14 ) &&
        ( crt0Result === '100' || crt0Result === '200' ) && resultDisplayValue !== null &&
        ( appCtxService.ctx.preferences.PLE_Rollup_Result_Enable !== undefined && appCtxService.ctx.preferences.PLE_Rollup_Result_Enable[ 0 ] === 'true' ) ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#50bed7';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    } else if( crt1Result === '100' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#DC0000';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    } else if( crt1Result === '200' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#00874F';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    } else if( crt1Result === '400' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#eb770a';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    } else if( crt1Result === '500' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#ffbb00';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
        color.style.backgroundColor = colorSrc;
        containerElem.appendChild( color );
    }
};
export let measuredValFn = function( vmo, containerElem ) {
    var color = document.createElement( 'div' );
    if( ( appCtxService.ctx.xrtSummaryContextObject &&
            appCtxService.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ||
            appCtxService.ctx.openedARObject &&
            appCtxService.ctx.openedARObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ) &&
        vmo && vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ] &&
        vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ].type !== 'STRING' ) {
        if( vmo.type === 'Att1AttributeAlignmentProxy' && vmo.props && vmo.props.att1SourceAttribute && vmo.props.att1SourceAttribute.dbValues[ 0 ] ) {
            var sourceElement = cdm.getObject( vmo.props.att1SourceAttribute.dbValues[ 0 ] );
        }
        // Only in case of normal parameter, assign color to measurement value.
        // For normal parameters, att0AttributeTable property value is null in case of TC13.3 & empty in case of TC13.1/TC13.2
        // For complex parameters att0AttributeTable dbValues get filled
        if( !sourceElement || sourceElement && sourceElement.props && sourceElement.props.att0AttributeTable && sourceElement.props.att0AttributeTable.dbValues &&
            ( sourceElement.props.att0AttributeTable.dbValues[ 0 ] === null || sourceElement.props.att0AttributeTable.dbValues[ 0 ] === '' ) ) {
            color.className = 'aw-visual-indicator';
            color.style.backgroundSize = '500px 500px';
            var maxValue = null;
            var minValue = null;
            var measuredValue = null;
            if( vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ] &&
                vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ].dbValue ) {
                maxValue = vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ].dbValue;
            }
            if( vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ] &&
                vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ].dbValue ) {
                minValue = vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ].dbValue;
            }
            if( vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ] &&
                vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ].uiValue ) {
                measuredValue = vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ].uiValue;
            }
            color.style.color = 'red';
            if( minValue === null && maxValue === null || vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ].type === 'STRING' && vmo.props[
                'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ].type === 'STRING' ||
                minValue === null && maxValue && measuredValue < maxValue || maxValue === null && minValue && measuredValue >= minValue || measuredValue >= minValue && measuredValue <= maxValue ) {
                color.style.color = 'black';
            }
        } else {
            if( sourceElement && sourceElement.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
                if( vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ] ) {
                    measuredValue = vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ].uiValue;
                }
            }
        }
    } else if( vmo.type === 'Att1AttributeAlignmentProxy' && vmo.props && vmo.props.att1SourceAttribute && vmo.props.att1SourceAttribute.dbValues[ 0 ] ) {
        var sourceElement = cdm.getObject( vmo.props.att1SourceAttribute.dbValues[ 0 ] );
        if( sourceElement && sourceElement.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
            if( vmo.props && vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ] ) {
                measuredValue = vmo.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ].uiValue;
            }
        }
    }
    if( !measuredValue ) {
        color.innerHTML = '';
    } else {
        color.innerHTML = measuredValue;
    }
    containerElem.appendChild( color );
};

export let resultStatusFn_rollup = function( vmo, containerElem ) {
    var crt0Result = null;
    var crt0RolledupResult = null;
    var resultDisplayValue = null;

    //For VR sub-types, Trends tab(Study,TR etc.)
    if( vmo.props && vmo.props.crt0RolledupResult && vmo.props.crt0RolledupResult.dbValue && vmo.props.crt0RolledupResult.displayValues[ 0 ] !== undefined ) {
        crt0RolledupResult = vmo.props.crt0RolledupResult.dbValue;
        resultDisplayValue = vmo.props.crt0RolledupResult.displayValues[ 0 ];
    }
    if( vmo.props && vmo.props.crt0Result && vmo.props.crt0Result.dbValue && vmo.props.crt0Result.displayValues[ 0 ] !== undefined ) {
        crt0Result = vmo.props.crt0Result.dbValue;
        if( crt0Result !== '300' ) {
            resultDisplayValue = vmo.props.crt0Result.displayValues[ 0 ];
        }
    }
    var color = document.createElement( 'div' );
    color.className = 'aw-visual-indicator';
    color.style.backgroundSize = '500px 500px';
    var colorSrc = null;
    if( ( crt0Result === '100' || crt0Result === '200' ) && resultDisplayValue !== null &&
        ( appCtxService.ctx.preferences.PLE_Rollup_Result_Enable !== undefined && appCtxService.ctx.preferences.PLE_Rollup_Result_Enable[ 0 ] === 'true' ) ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#50bed7';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
    } else if( crt0RolledupResult === '100' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#DC0000';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
    } else if( crt0RolledupResult === '200' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#00874F';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
    } else if( crt0RolledupResult === '400' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#eb770a';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
    } else if( crt0RolledupResult === '500' ) {
        color.innerHTML = resultDisplayValue;
        colorSrc = '#ffbb00';
        color.style.width = '43px';
        color.style.textAlign = 'center';
        color.style.color = 'white';
    }
    color.style.backgroundColor = colorSrc;

    containerElem.appendChild( color );
};

export default exports = {
    parameterResultStatusFn,
    resultStatusFn,
    measuredValFn,
    resultStatusFn_rollup
};
