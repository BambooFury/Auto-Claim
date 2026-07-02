import {
	ButtonItem,
	DropdownItem,
	ToggleField,
} from '@steambrew/client';
import React from 'react';

export interface WidgetSettings {
	panelSide: 'left' | 'right';
	tabColor: string;
	accentColor: string;
	indicatorColor: string;
	showOverlay: boolean;
	tabStyle: 'slim' | 'large' | 'floating';
}

export const widgetDefaults = (): WidgetSettings => ({
	panelSide: 'left',
	tabColor: 'gray',
	accentColor: 'rgba(255,255,255,0.5)',
	indicatorColor: '#ff7a3c',
	showOverlay: false,
	tabStyle: 'large',
});

type Option<T> = { data: T; label: string };

function options<T>(values: Array<{ value: T; label: string }>): Array<Option<T>> {
	return values.map((entry) => ({ data: entry.value, label: entry.label }));
}

const colorPresetOptions = options<string>([
	{ value: 'gray', label: 'Gray' },
	{ value: 'black', label: 'Black' },
	{ value: 'white', label: 'White' },
	{ value: 'blue', label: 'Blue' },
	{ value: 'red', label: 'Red' },
	{ value: '#ff7a3c', label: 'Orange' },
	{ value: '#f5c542', label: 'Yellow' },
	{ value: '#4caf50', label: 'Green' },
	{ value: '#2dd4bf', label: 'Teal' },
	{ value: '#22d3ee', label: 'Cyan' },
	{ value: '#8b5cf6', label: 'Purple' },
	{ value: '#c084fc', label: 'Violet' },
	{ value: '#ec4899', label: 'Pink' },
	{ value: '#d946ef', label: 'Magenta' },
]);

const COLOR_VALUES = colorPresetOptions.map((option) => option.data);

const panelSideOptions = options<WidgetSettings['panelSide']>([
	{ value: 'left', label: 'Left' },
	{ value: 'right', label: 'Right' },
]);

const tabStyleOptions = options<WidgetSettings['tabStyle']>([
	{ value: 'slim', label: 'Slim' },
	{ value: 'large', label: 'Large' },
	{ value: 'floating', label: 'Floating' },
]);

function NativeDropdown<T>({
	label,
	description,
	value,
	dropdownOptions,
	onChange,
}: {
	label: string;
	description?: string;
	value: T;
	dropdownOptions: Array<Option<T>>;
	onChange: (value: T) => void;
}) {
	return (
		<DropdownItem
			label={label}
			description={description}
			rgOptions={dropdownOptions}
			selectedOption={value}
			onChange={(option) => onChange(option.data as T)}
		/>
	);
}

function ColorSetting({
	label,
	description,
	value,
	onChange,
}: {
	label: string;
	description: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const known = COLOR_VALUES.indexOf(value) !== -1;
	return (
		<NativeDropdown<string>
			label={label}
			description={description}
			value={known ? value : 'gray'}
			dropdownOptions={colorPresetOptions}
			onChange={onChange}
		/>
	);
}

interface SettingsTabProps {
	widget: WidgetSettings;
	onWidget: (patch: Partial<WidgetSettings>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ widget, onWidget }) => {
	return (
		<>
			<ToggleField
				label="Background overlay"
				description="Dim the screen while the widget panel is open."
				checked={widget.showOverlay}
				onChange={(checked) => onWidget({ showOverlay: checked })}
			/>

			<ColorSetting
				label="Button color"
				description="Color of the side tab button on store pages."
				value={widget.tabColor}
				onChange={(value) => onWidget({ tabColor: value })}
			/>

			<ColorSetting
				label="Accent color"
				description="Color of tabs, highlights and active elements."
				value={widget.accentColor}
				onChange={(value) => onWidget({ accentColor: value })}
			/>

			<ColorSetting
				label="Indicator color"
				description="Color of the new-game notification dot on the side tab."
				value={widget.indicatorColor}
				onChange={(value) => onWidget({ indicatorColor: value })}
			/>

			<NativeDropdown<WidgetSettings['panelSide']>
				label="Panel side"
				description="Side of the screen the widget panel slides out from."
				value={widget.panelSide}
				dropdownOptions={panelSideOptions}
				onChange={(value) => onWidget({ panelSide: value })}
			/>

			<NativeDropdown<WidgetSettings['tabStyle']>
				label="Button style"
				description="Shape of the side tab button."
				value={widget.tabStyle}
				dropdownOptions={tabStyleOptions}
				onChange={(value) => onWidget({ tabStyle: value })}
			/>

			<ButtonItem layout="below" onClick={() => onWidget(widgetDefaults())}>
				Reset widget settings
			</ButtonItem>
		</>
	);
};