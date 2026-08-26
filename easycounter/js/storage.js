// 本地存储工具
const Storage = {
get(key, defaultValue = null) {
try {
const item = localStorage.getItem('easyCounter_' + key);
return item ? JSON.parse(item) : defaultValue;
} catch (e) {
return defaultValue;
}
},
set(key, value) {
try {
localStorage.setItem('easyCounter_' + key, JSON.stringify(value));
} catch (e) {
console.error('Storage error:', e);
}
},
remove(key) {
try {
localStorage.removeItem('easyCounter_' + key);
} catch (e) {
console.error('Storage remove error:', e);
}
},
clearVoteData() {
const keys = ['votes', 'totalVotes', 'namesData', 'groupedByLetter',
'availableLetters', 'hasActiveSession', 'lastUpdated'];
keys.forEach(key => this.remove(key));
},
saveVoteProgress(state) {
this.set('votes', state.votes);
this.set('totalVotes', state.totalVotes);
this.set('namesData', state.namesData);
this.set('groupedByLetter', state.groupedByLetter);
this.set('availableLetters', state.availableLetters);
this.set('hasActiveSession', true);
this.set('lastUpdated', Date.now());
},
loadVoteProgress() {
return {
votes: this.get('votes', {}),
totalVotes: this.get('totalVotes', 0),
namesData: this.get('namesData', []),
groupedByLetter: this.get('groupedByLetter', {}),
availableLetters: this.get('availableLetters', []),
lastUpdated: this.get('lastUpdated', 0)
};
},
hasActiveSession() {
return this.get('hasActiveSession', false);
}
};
