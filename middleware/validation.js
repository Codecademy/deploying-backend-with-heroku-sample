function onlyAlphaSomeChar(value) {
  const re = /^[ A-Z a-z 0-9 . , ; ' " ( ) & @ # % / ! ? * -]+$/;
  const allowed = re.test(value);
  // if (!allowed) console.error(
  //   `forbidden characters used. Your text can only contain these characters: A-Z a-z 0-9 . , ; ' " ( ) & @ # $ % / ! ? * -`
  // );
  // else console.log('string allowed');
  return allowed;
}