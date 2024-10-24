// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 */

/**
 * Defines {@link AwClsBlockService}
 *
 * @module js/AwClsBlockService
 */
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import AwClsAttributeAnnotation from 'viewmodel/AwClsAttributeAnnotationViewModel';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import AwSeparator from 'viewmodel/AwSeparatorViewModel';
import classifyUtils from 'js/classifyUtils';
import _ from 'lodash';
import $ from 'jquery';


const handleShowMandatory = ( children ) => {
    let result = false;
    let childBlockHasMandatory = false;
    _.forEach( children, ( child ) => {
        if( child.type !== 'Block' && child.vmps ) {
            if( child.vmps[0].isRequired ) {
                result = child.vmps[0].isRequired;
            }
        } else if( child.type === 'Block' ) {
            childBlockHasMandatory = handleShowMandatory( child.children );
        }
    } );
    return result || childBlockHasMandatory;
};

let expandCollapseInstance = function( instances, eventData ) {
    //see if it is an instance of attribute
    var idx = _.findIndex( instances, function( instance ) {
        return eventData.caption === instance.name;
    } );
    if ( idx !== -1 ) {
        instances[ idx ].propExpanded = !eventData.isCollapsed;
        return true;
    }
    return false;
};

/**
 * Toggle group between expanded and collapsed
 *
 * @param {Group} group - The group to be toggled
 * @param {data} data - The view model data
 * @param {Object} classifyState classify state
 * @param {Boolean} isChild to indicate recursive call
 */
export let expandOrCollapseBlock = function( attribute, eventData, classifyState, isChild ) {
    var blockId = eventData.name;
    var caption = eventData.caption;
    var needUpdate = false;
    var tmpState = { ...classifyState.value };
    var selectedPropGrp = null;
    if ( tmpState.selectedPropertyGroup ) {
        selectedPropGrp = tmpState.selectedPropertyGroup[0];
    }

    if ( caption.toLowerCase() === attribute.name.toLowerCase() ) {
        attribute.propExpanded = !eventData.isCollapsed;
        needUpdate = !isChild;
        if ( selectedPropGrp && attribute.name === selectedPropGrp.name ) {
            selectedPropGrp.propExpanded = attribute.propExpanded;
        }
    } else {
        if ( attribute.cardinalController && attribute.cardinalController.id !== '' ) {
            //see if it is an instance of attribute
            needUpdate = expandCollapseInstance( attribute.instances, eventData );
        }
        //Check child blocks
        if ( !needUpdate ) {
            _.forEach( attribute.children, function( child ) {
                if ( child.type === 'Block' &&  caption.includes( child.name ) ) {
                    expandOrCollapseBlock( child, eventData, classifyState, true );
                }
            } );
        }
    }
    if ( needUpdate ) {
        tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.attrs, attribute );
        classifyState.update( tmpState );
    }
};

/**
 * render function for AwClsBlock
 * @param {*} props props
 * @returns {JSX.Element} react component
 */
export const awClsBlockServiceRenderFunction = ( props ) => {
    const { attribute, classifyState, responseState, viewModel, ...prop } = props;
    let { data } = viewModel;

    let propDetails = prop.propDetails;
    let level = propDetails.level;
    let view = classifyState.value.panelMode;

    const renderAttributeInt = ( attribute, level, parentDetails ) => {
        const attrname = attribute.name;

        if ( attribute.type === 'Separator' ) {
            return (
                renderSeparator()
            );
        }

        if ( attribute.type !== 'Block' && attribute.visible ) {
            return (
                <AwClsAttributeAnnotation attr={attribute} attrname={attrname}
                    propDetails= {parentDetails ? parentDetails : propDetails}
                    classifyState={classifyState}
                    responseState={responseState}>
                </AwClsAttributeAnnotation>
            );
        }
        if ( attribute.type === 'Block' ) {
            return (
                renderArray( attribute.children, level )
            );
        }
    };

    const renderCardinalBlock = ( attribute, level ) => {
        var cardinalBlock = attribute.cardinalController;
        var parentDetails = _.clone( propDetails );
        parentDetails.cardinalAttribute = attribute;
        var isVisible = attribute.visible || cardinalBlock.visible;
        let isTableViewVisible = props.selectedBlockAttr.blockId === attribute.blockId && props.selectedBlockAttr.tableView;
        var context = {
            attribute : attribute,
            selectedBlockAttr: props.selectedBlockAttr,
            gridProvider: props.blockGridProvider,
            isTableViewVisible: isTableViewVisible,
            classifyState: props.classifyState
        };

        return (
            <div>
                { isVisible && <ul className='aw-ui-tree' >
                    <div className='aw-clspanel-block' onMouseEnter={ ( event ) => selectBlock( event ) }>
                        <div className='aw-clspanel-cardinalBlock' title={ attribute.name }>
                            <AwCommandPanelSection caption={ attribute.name } collapsed={ !attribute.propExpanded } name={attribute.blockId} context={ context } anchor={ data.classifyViewCommands }>
                                {/* Cardinal Property */ }
                                <div className='aw-clspanel-treeValueSection'>
                                    { renderAttributeInt( cardinalBlock, level, parentDetails ) }
                                </div>
                                {/* Cardinal Block. Add block for each instance */ }
                                { attribute.instances &&
                                    <div>
                                        {/* Cardinal Block. In List View.*/ }
                                        { !isTableViewVisible && <ul className='aw-ui-tree' >
                                            { renderArray( attribute.instances, level + 1, attribute ) }
                                        </ul>
                                        }
                                        {/* Cardinal Block. In Table View.*/ }
                                        { isTableViewVisible &&
                                            <AwSplmTable className='aw-clspanel-table' { ...props.blockGridProvider } ></AwSplmTable>
                                        }
                                    </div>
                                }
                            </AwCommandPanelSection>
                        </div>
                    </div>
                </ul>
                }
            </div >
        );
    };

    const renderPolymorphicBlock = ( prop, level, parentAttribute ) => {
        var parentDetails = _.clone( propDetails );
        if ( parentAttribute.cardIndex ) {
            parentDetails.cardinalAttribute = parentAttribute;
        }
        return (
            <div className='aw-clspanel-treeValueSection'>
                { renderAttributeInt( prop, level, parentDetails ) }
            </div>
        );
    };


    const renderSeparator = () => {
        return(
            <AwSeparator></AwSeparator>
        );
    };

    const renderAttribute = ( attribute, level, parentAttribute ) => {
        var parentDetails = _.clone( propDetails );
        if ( parentAttribute.cardIndex ) {
            parentDetails.cardinalAttribute = parentAttribute;
        }
        if( attribute.type === 'Separator' ) {
            return (
                renderSeparator()
            );
        }
        if ( attribute.type !== 'Block' && ( !attribute.isCardinalControl || attribute.isCardinalControl !== '' ) ) {
            return (
                renderAttributeInt( attribute, level, parentDetails )
            );
        }
        if ( attribute.type === 'Block' ) {
            return (
                renderBlock( attribute, level )
            );
        }
    };

    const selectBlock = ( event ) => {
        var parentBlks = document.getElementsByClassName( 'aw-clspanel-parentHover' );
        for ( var i = 0; i < parentBlks.length; i++ ) {
            var parentBlk = parentBlks[ i ];
            parentBlk.className = 'aw-clspanel-block ng-scope';
        }
        var current = document.getElementsByClassName( 'aw-clspanel-childHover' );
        if ( current && current[ 0 ] ) {
            current[ 0 ].className = current[ 0 ].className.replace( ' aw-clspanel-childHover', '' );
        }
        var elem = $( event.target ).closest( '.aw-ui-tree' );
        if ( elem.length > 0 ) {
            var parentElem = $( elem ).closest( '.aw-clspanel-block' );
            if ( parentElem.length > 0 ) {
                var parentClass = parentElem[ 0 ].className;
                if ( parentClass.indexOf( 'aw-clspanel-parentHover' ) < 0 ) {
                    parentElem[ 0 ].className += ' aw-clspanel-parentHover';
                }
                elem[ 0 ].firstElementChild.className += ' aw-clspanel-childHover';
            } else {
                //top level
                elem[ 0 ].firstElementChild.className += ' aw-clspanel-parentHover';
            }
        }
    };

    const renderArray = ( attributes, level, parentAttribute ) => {
        const attrs = Object.entries( attributes ).map( ( [ key, attr ], index ) => {
            if ( attr.isCardinalControl !== 'true' ) {
                return (
                    <div key={attr.id} >
                        { renderAttribute( attr, level, parentAttribute ) }
                    </div>
                );
            }
        } );
        return (
            <div>{ attrs }</div>
        );
    };

    const renderBlock = ( attribute, level ) => {
        var isCardinalBlock = Boolean( attribute.cardinalController && attribute.cardinalController.id !== undefined );

        const isMandatory = handleShowMandatory( attribute.children );
        const showMandatory = classifyState.selectedClass.showMandatory;

        var isVisible = ( !showMandatory || isMandatory && showMandatory ) && attribute.visible;
        var polymorphicProp = attribute.polymorphicTypeProperty;
        let blockId = attribute.blockId;
        if ( !blockId && !isCardinalBlock ) {
            blockId = '';
        }

        return (
            <div>
                { !isCardinalBlock && <div>
                    { isVisible && <ul className='aw-ui-tree' >
                        <div className='aw-clspanel-block' onMouseEnter={( event )=> selectBlock( event )}>
                            <AwCommandPanelSection caption={attribute.name} collapsed={!attribute.propExpanded} name={blockId} context={attribute} >
                                { polymorphicProp && renderPolymorphicBlock( polymorphicProp, level, attribute ) }
                                <div className='aw-clspanel-treeValueSection'>
                                    { renderArray( attribute.children, level + 1, attribute ) }
                                </div>
                            </AwCommandPanelSection>
                        </div>
                    </ul> }
                </div> }
                {isCardinalBlock && renderCardinalBlock( attribute, level )}
            </div>
        );
    };

    return (
        <div>
            { renderBlock( attribute, level ) }
        </div>
    );
};
