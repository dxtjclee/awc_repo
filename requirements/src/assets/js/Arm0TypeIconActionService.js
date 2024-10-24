import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';

export const arm0TypeIconCellRenderFunction = ( props ) => {
    const value = props.vmo;
    const handleOnClickEvent = ( event ) => {
        eventBus.publish( 'requirements.handleCommandSelection', { selectedRow:value } );
    };

    if( value && value.iconId ) {
        return (
            <div onClick={handleOnClickEvent} onKeyUp={()=>{}} role='button' tabIndex={0} className='aw-tcWidgets-modelTypeCell aw-requirement-tooltipCell'>
                <AwIcon iconId={value.iconId} className='aw-base-icon'></AwIcon>
                <span title={value.displayName} className='aw-requirement-tooltipCellLabel'>{value.displayName}</span>
            </div>
        );
    }

    return (
        <div onClick={handleOnClickEvent} onKeyUp={()=>{}} role='button' tabIndex={0} className='aw-tcWidgets-modelTypeCell'>
            <span title={value.displayName} className='aw-tcWidgets-modelTypeCellTitle'>{value.displayName}</span>
        </div>
    );
};

