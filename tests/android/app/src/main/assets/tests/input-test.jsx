import React, { useState } from 'react';

export default function InputTest() {
    const [text, setText] = useState('');
    const [city, setCity] = useState('');
    const [password, setPassword] = useState('');
    const [selectedFruit, setSelectedFruit] = useState('Apple');
    const [isChecked, setIsChecked] = useState(false);
    const [gender, setGender] = useState('Male');
    const [bio, setBio] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    return (
        <scroll className="flex-1">
            <div className="flex flex-col gap-4 p-4">
                <span className="text-lg font-bold text-themed">Input & Form Controls Test</span>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Standard Input (onChange)</label>
                    <input
                        type="text"
                        placeholder="Type something..."
                        value={text}
                        onChange={(e) => setText(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                    <span className="text-xs text-muted">Value: {text}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Email Input</label>
                    <input
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Phone Input</label>
                    <input
                        type="tel"
                        placeholder="+1 234 567 890"
                        value={phone}
                        onChange={(e) => setPhone(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Password Input</label>
                    <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Textarea (Bio)</label>
                    <textarea
                        placeholder="Tell us about yourself..."
                        value={bio}
                        rows={3}
                        onChange={(e) => setBio(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Datalist (City Selection)</label>
                    <input
                        type="text"
                        list="cities"
                        id="city-input"
                        placeholder="Select a city..."
                        value={city}
                        onChange={(e) => setCity(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    />
                    <datalist id="cities">
                        <option value="Boston" />
                        <option value="Cambridge" />
                        <option value="New York" />
                        <option value="San Francisco" />
                        <option value="Seattle" />
                    </datalist>
                    <span className="text-xs text-muted">Selected: {city}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Select (Spinner)</label>
                    <select
                        value={selectedFruit}
                        onChange={(e) => setSelectedFruit(e.value)}
                        className="p-2 border border-themed rounded bg-surface text-themed"
                    >
                        <option value="Apple" />
                        <option value="Banana" />
                        <option value="Cherry" />
                        <option value="Date" />
                    </select>
                    <span className="text-xs text-muted">Selected Fruit: {selectedFruit}</span>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <checkbox
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.checked)}
                    />
                    <label className="text-sm text-themed">Accept Terms & Conditions</label>
                </div>
                <span className="text-xs text-muted">Checked: {isChecked ? 'Yes' : 'No'}</span>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Radio Group (Gender)</label>
                    <radiogroup
                        onChange={(e) => setGender(e.value)}
                        className="flex flex-col gap-1"
                    >
                        <radio text="Male" checked={gender === 'Male'} />
                        <radio text="Female" checked={gender === 'Female'} />
                        <radio text="Other" checked={gender === 'Other'} />
                    </radiogroup>
                    <span className="text-xs text-muted">Selected Gender: {gender}</span>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="text-xs text-blue-700">
                        Note: AutoCompleteTextView (datalist) requires at least 1 character to show suggestions.
                    </span>
                </div>
            </div>
        </scroll>
    );
}
