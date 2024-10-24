// Copyright (c) 2022 Siemens

/**
 * @module js/Att1MapAttributeCell
 */
import AwModelIcon from 'viewmodel/AwModelIconViewModel';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';

export const att1MapAttributeCellRenderFn = ( props ) => {
    const value = props.vmo;
    var sourceAttribute = cdm.getObject( value.props.att1SourceAttribute.dbValue );
    var paramDef = undefined;
    if ( sourceAttribute.props.att0AttrDefRev ) {
        paramDef = cdm.getObject( sourceAttribute.props.att0AttrDefRev.dbValues[0] );
    }
    var ctx = appCtxSvc.getCtx();
    var isShowDefintion = false;
    if( ctx && ctx.preferences && ctx.preferences.PLE_Parameter_Create_With_Definition_Ux ) {
        isShowDefintion = ctx.preferences.PLE_Parameter_Create_With_Definition_Ux[0] === 'true';
    }

    return (

        <div className='aw-default-cell sw-row'>
            <div className='sw-cell-image sw-column'>
                <AwModelIcon vmo={value}></AwModelIcon>
            </div>
            <div className='sw-column'>
                {
                    sourceAttribute && sourceAttribute.props.object_name &&
                    <div className='aw-widgets-cellListCellTitleBlock'>
                        <span className='aw-widgets-cellListCellTitle' title={sourceAttribute.props.object_name.uiValues[0]} ><b>{sourceAttribute.props.object_name.uiValues[0]}</b><br></br></span>
                    </div>
                }
                {
                    value.props.att1SourceElement &&
                    value.props.att1SourceElement.displayValues.length > 0 &&
                    <span title={value.props.att1SourceElement.displayValues[0]} >{value.props.att1SourceElement.displayValues[0]}</span>
                }
                {
                    sourceAttribute.props.att0Uom &&
                    sourceAttribute.props.att0Uom.uiValues.length > 0 &&
                    <div className='sw-defaultCell-properties'>
                        <label className='sw-property-name'>{props.i18n.Units}:</label>
                        <label className='aw-widgets-propertyValue'>{sourceAttribute.props.att0Uom.uiValues[0]}</label>
                    </div>
                }
                {
                    isShowDefintion && paramDef &&
                    paramDef.props.object_name &&
                    <div className='sw-defaultCell-properties'>
                        <label className='sw-property-name'>{props.i18n.attributeDefinition}:</label>
                        <label className='aw-widgets-propertyValue'>{paramDef.props.object_name.uiValues[0]}</label>
                    </div>
                }
            </div>
        </div>
    );
};

