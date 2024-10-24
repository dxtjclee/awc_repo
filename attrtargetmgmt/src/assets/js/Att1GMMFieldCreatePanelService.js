
import appCtxSvc from 'js/appCtxService';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

export const att1GMMFieldCreatePanelRenderFn = ( props ) => {
    const getWidgetData = ( internalPropName, propName ) => {
        var dataType;
        var listOfValues;
        var parameter = undefined;
        var selectedParameterDefintion;
        var ctx = appCtxSvc.getCtx();
        if ( ctx.panelContext ) {
            if( ctx.panelContext.selectedParameterDefinition ) {
                selectedParameterDefintion = ctx.panelContext.selectedParameterDefinition;
            } else{
                dataType = ctx.panelContext.datatType;
            }
        }
        if( selectedParameterDefintion ) {
            dataType = selectedParameterDefintion.props.att0AttrType.dbValues[0];
            var hasListOfValues = false;
            if ( selectedParameterDefintion ) {
                listOfValues = selectedParameterDefintion.props.att0ListOfValues.uiValues;
                hasListOfValues = listOfValues.length > 0;
            }
            if ( selectedParameterDefintion.props &&
                selectedParameterDefintion.props.Att0HasDefaultParamValue &&
                selectedParameterDefintion.props.Att0HasDefaultParamValue.dbValues &&
                selectedParameterDefintion.props.Att0HasDefaultParamValue.dbValues.length > 0 ) {
                parameter = cdm.getObject( selectedParameterDefintion.props.Att0HasDefaultParamValue.dbValues[0] );
            }
        }
        var widgetName = propName;
        var defaultWidget = '';
        if ( dataType === 'Integer' ) {
            defaultWidget = propName + 'TextBoxStr';
            if ( hasListOfValues ) {
                widgetName += 'LOVInt';
            } else {
                widgetName += 'TextBoxInt';
            }
        } else if ( dataType === 'Double' ) {
            defaultWidget = propName + 'TextBoxStr';
            if ( hasListOfValues ) {
                widgetName += 'LOVDbl';
            } else {
                widgetName += 'TextBoxDbl';
            }
        } else {
            defaultWidget = propName + 'TextBoxStr';
            if ( hasListOfValues ) {
                widgetName += 'LOVStr';
            } else {
                widgetName += 'TextBoxStr';
            }
        }
        var isValidParameter = parameter !== undefined && parameter !== null;
        if ( props.fields[widgetName] ) {
            if( !props.fields[widgetName].dirty  && props.fields[widgetName].touched === 'false' && isValidParameter && parameter.props[internalPropName] ) {
                props.fields[widgetName].value = parameter.props[internalPropName].uiValues[ 0 ];
                props.fields[widgetName].fielddata.uiValue = parameter.props[internalPropName].uiValues[ 0 ];
                props.fields[widgetName].fielddata.dbValue = parameter.props[internalPropName].uiValues[ 0 ];
            }
            return props.fields[widgetName];
        }
        if( isValidParameter ) {
            props.fields[defaultWidget].uiValue = parameter.props[internalPropName].uiValues[ 0 ];
        }
        return props.fields[defaultWidget];
    };

    var ctx = appCtxSvc.getCtx();
    if ( ctx.panelContext ) {
        var widgetData = {};
        var propName = 'att0Goal';
        if ( props.fielddata.propertyName === 'att0Goal' ) {
            widgetData = getWidgetData( 'att0Goal', 'goal' );
            propName = 'att0Goal';
        } else if ( props.fielddata.propertyName === 'att0Min' ) {
            widgetData = getWidgetData( 'att0Min', 'min' );
            propName = 'att0Min';
        } else if ( props.fielddata.propertyName === 'att0Max' ) {
            widgetData = getWidgetData( 'att0Max', 'max' );
            propName = 'att0Max';
        }
        if ( widgetData.dirty || widgetData.touched === 'true' ) {
            props.vmo.props[propName].displayValueUpdated = true;
            props.vmo.props[propName].valueUpdated = true;
            props.vmo.props[propName].dbValue = widgetData.value;
        }

        return (
            <AwWidget className='aw-attrtargetmgmt-GMMCreateField' {...widgetData}></AwWidget>
        );
    }
};

