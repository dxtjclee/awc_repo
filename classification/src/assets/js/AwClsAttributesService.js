// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsAttributesService}
 *
 * @module js/AwClsAttributesService
 */
import _ from 'lodash';
import AwCheckbox from 'viewmodel/AwCheckboxViewModel';
import AwClsList from 'viewmodel/AwClsListViewModel';
import AwClsPropertyLabel from 'viewmodel/AwClsPropertyLabelViewModel';
import AwClsComplexProperty from 'viewmodel/AwClsComplexPropertyViewModel';
import AwClsSimpleProperty from 'viewmodel/AwClsSimplePropertyViewModel';
import AwIcon from 'viewmodel/AwIconViewModel';
import AwIconButton from 'viewmodel/AwIconButtonViewModel';
import AwPropertyLabel from 'viewmodel/AwPropertyLabelViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import classifyUtils from 'js/classifyUtils';
import classifySvc from 'js/classifyService';
import uwPropertyService from 'js/uwPropertyService';
import classifyAdminConstants from 'js/classifyAdminConstants';
import localeSvc from 'js/localeService';

export let ATTRIBUTE_ID_SUBSTRING = 'cst0';
export let ATTRIBUTE_ID = 'IRDI';

const AwIconHOC = ExtendedTooltip( AwIcon );


export const updateInstances = ( cardinalAttribute, classifyState ) => {
    const tmpState = { ...classifyState.value };

    const size = cardinalAttribute.instances.length;
    cardinalAttribute.hasBlockChildren = size > 0;
    tmpState.selectedCardinalAttribute = cardinalAttribute;
    tmpState.updateInstances = cardinalAttribute.id + size;
    classifyState.update( tmpState );
};

/*
 * Updates the attribute on change of attribute's unit
 *
 * @param {Object} classifyState - classifyState
 * @param {Object} attribute - attribute
 * @param {Object} unitLink - unitLink
 */
export const updateUnitValue = ( classifyState, attribute, unitLink ) => {
    if( attribute.vmps && attribute.vmps[2].uiValue !== unitLink.value.uiValue ) {
        if ( attribute.updatedUnits && !unitLink.value.valueUpdated ) {
            unitLink.value.uiValue = attribute.vmps[2].uiValue;
        } else  {
            const tmpState = { ...classifyState.value };
            attribute.vmps[2] = unitLink.value;
            attribute.updatedUnits = false;
            tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.attrs, attribute );
            classifyState.update( tmpState );
            unitLink.value.valueUpdated = false;
        }
    }
};

/**
 * Processing method for attribute properties
 * @param {Object} tmpProperties existing attribute properties
 * @param {Object} key key to search for 
 * @param {Object} tmpState state object
 */
export const prepareVMOProp = async function( selectedProp, key, tmpState  ) {
    var keyDispl;
    var value = classifySvc.getPropertyValue(
        selectedProp.origAttributeInfo.attributeProperties, key );
    var keyNew = 'ClassificationAdminMessages.' + key;
    if( selectedProp.type !== 'Block' ) {
        if( key === classifySvc.ATTRIBUTE_TYPE_METRIC && selectedProp.attrDefn.isLOV ) {
            value = 'KEY LOV' + '(' + selectedProp.attrDefn.formatLengthMetric + ')';
        } else if( key === classifySvc.ATTRIBUTE_TYPE_NONMETRIC && selectedProp.attrDefn.isLOV ) {
            value = 'KEY LOV' + '(' + selectedProp.attrDefn.formatLengthNonMetric + ')';
        } else if( key === classifySvc.ATTRIBUTE_TYPE_METRIC ) {
            value = selectedProp.attrDefn.attrTypeForAdmin + '(' + selectedProp.attrDefn.formatLengthMetric + ')';
        } else if( key === classifySvc.ATTRIBUTE_TYPE_NONMETRIC ) {
            value = selectedProp.attrDefn.attrTypeForAdmin + '(' + selectedProp.attrDefn.formatLengthNonMetric + ')';
        } else if ( key === classifySvc.UNIT_SYSTEM_METRIC  ) {
            value = selectedProp.attrDefn.unitSystemMetric;
        } else if ( key === classifySvc.UNIT_SYSTEM_NONMETRIC  ) {
            value = selectedProp.attrDefn.unitSystemNonMetric;
        }
    }

    if( key === classifySvc.ATTRIBUTE_TYPE && classifyUtils.checkIfAttributeIsBlockorFrame( selectedProp.origAttributeInfo )  ) {
        var temp = 'ClassificationAdminMessages.' + 'FRAME';
        value = await localeSvc.getLocalizedTextFromKey( temp, true );
    }
    if( selectedProp.attrDefn && selectedProp.attrDefn.isArray && key === classifySvc.ATTR_CARDINALITY  ) {
        value = selectedProp.attrDefn.arraySize;
    }

    keyDispl =  await localeSvc.getLocalizedTextFromKey( keyNew, true );
    var vmoProp = uwPropertyService.createViewModelProperty( keyDispl, keyDispl, '', value.toString(), value.toString() );
    vmoProp.uiValue = value.toString();
    tmpState.appClassData.propAttr.push( vmoProp );
};


/**
 * Deselecting the current node
 * @param {Array} attrs List of attributes
 * @param {Object} selectedPropertyGroup selected property group
 */
export let deselection = function( attrs, selectedPropertyGroup ) {
    for( var counter = 0; counter < attrs.length; counter++  ) {
        if( attrs[counter].selected === true || attrs[counter].selected === undefined ) {
            attrs[counter].selected = false;
        }
        if( attrs[counter].children && attrs[counter].children.length > 0 ) {
            deselection( attrs[counter].children );
        }
    }
    if( selectedPropertyGroup && selectedPropertyGroup.length > 0 ) {
        for( var counter = 0; counter < selectedPropertyGroup.length; counter++  ) {
            if( selectedPropertyGroup[counter].selected === true || selectedPropertyGroup[counter].selected === undefined ) {
                selectedPropertyGroup[counter].selected = false;
            }
            if( selectedPropertyGroup[counter].children && selectedPropertyGroup[counter].children.length > 0 ) {
                deselection( selectedPropertyGroup[counter].children );
            }
        }
    }
};

/**
 * Processing method for selction info
 * @param {Array} attrs List of attributes
 * @param {Object} selectedProp currently selected attribute
 * @param {Object} selectedPropertyGroup selected property group
 */
export let selectionInfo = function( attrs, selectedProp, selectedPropertyGroup ) {
    //find the attribute in the given list of attrs
    for( var counter = 0; counter < attrs.length; counter++  ) {
        if( attrs[counter].id === selectedProp.id ) {
            attrs[counter].selected = true;
            return;
        }
        if( attrs[counter].children && attrs[counter].children.length > 0 ) {
            selectionInfo( attrs[counter].children, selectedProp );
        }
    }
    if( selectedPropertyGroup && selectedPropertyGroup.length > 0 ) {
        for( var counter = 0; counter < selectedPropertyGroup.length; counter++  ) {
            if( selectedPropertyGroup[counter].id === selectedProp.id ) {
                selectedPropertyGroup[counter].selected = true;
                return;
            }
            if( selectedPropertyGroup[counter].children && selectedPropertyGroup[counter].children.length > 0 ) {
                selectionInfo( selectedPropertyGroup[counter].children, selectedProp, selectedPropertyGroup );
            }
        }
    }
};

/**
 * following method assign the attribute properties of selected property to subpanelcontext's searchState
 * it is called when clicked on any property in Application class tab at nodes sublocation (cls manager)
 * @param {Object} selectedProp selected property in properties section
 * @param {Object} searchState subPanelContext's searchState
 */
export const getAttributeProperties = function( selectedProp, searchState ) {
    let isSMLattr = false;
    const tmpState = { ...searchState.value };
    tmpState.appClassData.attributesVisible = true;
    tmpState.appClassData.propAttr = [];

    //check if its deselction click
    if( tmpState.appClassData.selectedProp && selectedProp.id === tmpState.appClassData.selectedProp.id ) {
        //its pure deselection
        deselection( tmpState.attrs, tmpState.selectedPropertyGroup );
        tmpState.appClassData.selectedProp = null;
    } else {
        deselection( tmpState.attrs, tmpState.selectedPropertyGroup );
        selectionInfo( tmpState.attrs, selectedProp, tmpState.selectedPropertyGroup );
        var attrId = selectedProp.origAttributeInfo.attributeId;
        if( attrId.substring( 0, 4 ) === classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID_SUBSTRING ) {
            attrId = attrId.substring( 4, attrId.length );
        } else if( attrId.substring( 0, 4 ) === classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID_SUBSTRING_SML0 ) {
            attrId = attrId.substring( 4, attrId.length );
            isSMLattr = true;
        }

        if ( isSMLattr ) {
            //For SML attributes
            if( selectedProp.type !== 'Block' ) {
                var vmoProp1 = uwPropertyService.createViewModelProperty( classifyAdminConstants.ID, classifyAdminConstants.ID, '', attrId.toString(), attrId.toString() );
                vmoProp1.uiValue = attrId.toString();
                tmpState.appClassData.propAttr.push( vmoProp1 );
                _.forEach( classifySvc.UNCT_ATTR_PROP_I18N_DISP, async function( key ) {
                    prepareVMOProp( selectedProp, key, tmpState  );
                } );
            } else {
            //Only attribute type
                prepareVMOProp( selectedProp, classifySvc.ATTRIBUTE_TYPE, tmpState );
            }
        } else {
            //For CST attributes
            var vmoProp1 = uwPropertyService.createViewModelProperty( classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID, classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID, '', attrId.toString(), attrId.toString() );
            vmoProp1.uiValue = attrId.toString();
            tmpState.appClassData.propAttr.push( vmoProp1 );

            _.forEach( classifySvc.UNCT_ATTR_PROP_CST_DISP, async function( key ) {
                prepareVMOProp( selectedProp, key, tmpState );
            } );
        }
        tmpState.appClassData.selectedProp = selectedProp;
    }


    searchState.update( tmpState );
};


/**
  * render function for AwClsAttributes
  * @param {*} param0 context for render function interpolation
  * @returns {JSX.Element} react component
  */
// eslint-disable-next-line complexity
export const AwClsAttributesServiceRenderFunction = (  props ) => {
    const { actions, attrs, attribute, ctxMin, classifyState,  fields, propDetails, viewModel, responseState, ...prop } = props;
    const unitLink = prop.unitLink;
    const { cardinalCommand } = fields;
    const { data, dataProviders } = viewModel;


    const isAdmin = classifyState.value.isAdmin;

    const selectedClass = classifyState.value.selectedClass;
    const showAnno = selectedClass.showAnno;
    const hasAnno = selectedClass.hasAnno;
    const panelMode = classifyState.value.panelMode;
    const updateMode = panelMode !== -1;

    const isMandatoryProperty = propDetails.isMandatory;
    const showMandatoryProperty = classifyState.selectedClass.showMandatory;
    let attr = attrs[0];
    let anno = attrs[1];
    let unit = attrs[2];
    if( !attr.required && isMandatoryProperty ) {
        attr.required = isMandatoryProperty;
    }

    const parentAttribute = propDetails.parentAttribute;
    const showMinmaxMsg = propDetails.showMinmaxMsg;
    const labelProps = propDetails.labelProps;

    const hasLabelProps = labelProps && labelProps !== '';
    if ( hasLabelProps ) {
        attr.fielddata.labelProps = labelProps;
    }

    const showAllProp = selectedClass.showAllProp === true || attr.fielddata.uiValue !== '';

    const isBool = attr && attr.typex === 'BOOLEAN';
    const boolViewMode = isBool && !updateMode;
    var boolValue = attr.value;
    boolValue = boolValue === undefined ? false : boolValue;

    const labelStyle = !isBool ||  isBool && panelMode === -1;
    const toggleMetric = classifyState.value.currentUnitSystem ? classifyState.value.currentUnitSystem.dbValue : undefined;
    const newUnit = classifyState.value.updateMetric ? attribute.unitSystem.unitName : unitLink.propertyName;

    const hasUnits = unitLink && unitLink.value && unitLink.value.propertyDisplayName && unitLink.value.propertyDisplayName !== '';
    const hasMinMax = showMinmaxMsg && showMinmaxMsg !== '';

    const cardinalProp = updateMode && parentAttribute.isCardinalControl === 'true';
    const complex = attrs.length > 3;
    const nonBool = !isBool || !updateMode;

    const propertyIsVisible = ( showAllProp || updateMode ) && !showMandatoryProperty || isMandatoryProperty && showMandatoryProperty;
    let formatType = attribute.unitSystem.formatDefinition.formatType;

    const renderBoolAttribute = ( ) => {
        return (
            <div>
                <AwCheckbox className='aw-clspanel-extendedPropBool' {...attr}/>
                {hasAnno  && showAnno  && <AwPropertyLabel className='aw-clspanel-propertyAnnotationLabelBool' {...anno} >
                </AwPropertyLabel>}
            </div>
        );
    };

    const renderAttribute = () => {
        return (
            <div className='aw-clspanel-propertyContainer'>
                { ( !isBool || !updateMode ) && <AwClsPropertyLabel
                    attr={attr} anno={anno}
                    classifyState={classifyState}>
                </AwClsPropertyLabel>}

                { nonBool && !complex &&
                     <AwClsSimpleProperty
                         attr={attr}
                         instIndex={attribute.instIndex}
                         propDetails= {propDetails}
                         classifyState={classifyState}
                         responseState={responseState}>
                     </AwClsSimpleProperty> }
                { nonBool && complex &&
                     <AwClsComplexProperty
                         attrs={attrs}
                         formatType={formatType}
                         classifyState={classifyState}>
                     </AwClsComplexProperty> }


                { isBool && updateMode && renderBoolAttribute( ) }

                { hasUnits && <AwClsList attr={attr}
                    unitLink={unitLink}
                    parentAttribute={parentAttribute}
                    toggleMetric={toggleMetric}
                    updateMetric={classifyState.value.updateMetric}
                    updatedUnit={newUnit}
                    updateMode={updateMode}>
                </AwClsList> }

                { cardinalProp && <AwIconButton command={cardinalCommand}></AwIconButton> }

                {updateMode && hasMinMax &&
                    // add tabindex for wcag
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    <div tabIndex={0} className='aw-clspanel-showMinMax'>
                        <AwIconHOC iconId='homeHelp'
                            extendedTooltipOptions="{alignment : 'top'}"
                            extendedTooltip='data.showMinMaxTooltip'
                            extTooltipData={data}
                            extendedTooltipContext={showMinmaxMsg}>
                        </AwIconHOC>
                    </div>}
            </div>
        );
    };

    const renderAdminAttribute = () => {
        return(
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div className={ attribute.selected ? 'sw-aria-border aw-widgets-cellListItem aw-widgets-cellTop aw-widgets-cellListItemSelected' : 'sw-row aw-clsadmin-propertyContainer'}
                onClick={actions.onClickProp}
                role='button'
                tabIndex={0}>
                { <AwClsPropertyLabel
                    attr={attr}
                    classifyState={classifyState} className='aw-cls-labelselect'>
                </AwClsPropertyLabel>}
            </div>
        );
    };

    return (
        <div className='aw-clspanel-pair'>
            { propertyIsVisible && !isAdmin && renderAttribute() }
            { isAdmin && renderAdminAttribute()}
        </div>
    );
};
