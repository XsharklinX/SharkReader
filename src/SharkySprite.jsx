import React from 'react';

const px = (x, y, w, h, fill, key) => (
    <rect key={key || `${x}-${y}-${w}-${h}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />
);

const Sparkles = () => (
    <>
        {px(3, 5, 2, 2, '#fde68a')}
        {px(5, 3, 1, 1, '#fde68a')}
        {px(27, 7, 2, 2, '#fde68a')}
        {px(25, 5, 1, 1, '#fde68a')}
    </>
);

const SleepMarks = () => (
    <>
        <text x="22" y="7" fill="#bae6fd" fontSize="4" fontFamily="monospace" fontWeight="900">Z</text>
        <text x="26" y="4" fill="#bae6fd" fontSize="3" fontFamily="monospace" fontWeight="900">z</text>
    </>
);

const SpeechBubble = ({ tone = '#38bdf8', children }) => (
    <>
        {px(19, 1, 10, 8, 'rgba(15,23,42,0.85)', 'bubble-shadow')}
        {px(20, 1, 8, 7, '#0f172a', 'bubble-base')}
        {px(21, 2, 6, 5, '#f8fafc', 'bubble-fill')}
        {px(20, 8, 2, 1, '#0f172a', 'bubble-tail-shadow')}
        {px(21, 7, 2, 1, '#f8fafc', 'bubble-tail-fill')}
        {children(tone)}
    </>
);

const renderEmote = (emote) => {
    if (!emote || emote === 'none') return null;
    switch (emote) {
        case 'heart':
            return (
                <SpeechBubble tone="#fb7185">
                    {(tone) => (
                        <>
                            {px(22, 3, 1, 1, tone)}
                            {px(24, 3, 1, 1, tone)}
                            {px(21, 4, 5, 2, tone)}
                            {px(22, 6, 3, 1, tone)}
                            {px(23, 7, 1, 1, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'laugh':
            return (
                <SpeechBubble tone="#f59e0b">
                    {(tone) => (
                        <>
                            {px(22, 4, 1, 1, tone)}
                            {px(24, 4, 1, 1, tone)}
                            {px(21, 5, 2, 1, tone)}
                            {px(24, 5, 2, 1, tone)}
                            {px(22, 6, 3, 1, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'sad':
            return (
                <SpeechBubble tone="#60a5fa">
                    {(tone) => (
                        <>
                            {px(23, 3, 2, 3, tone)}
                            {px(22, 6, 4, 1, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'idea':
            return (
                <SpeechBubble tone="#22c55e">
                    {(tone) => (
                        <>
                            {px(23, 3, 2, 3, tone)}
                            {px(22, 5, 4, 1, tone)}
                            {px(23, 6, 2, 1, '#facc15')}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'surprise':
            return (
                <SpeechBubble tone="#a855f7">
                    {(tone) => (
                        <>
                            {px(23, 3, 2, 1, tone)}
                            {px(22, 4, 4, 2, tone)}
                            {px(23, 6, 2, 1, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'ellipsis':
            return (
                <SpeechBubble tone="#38bdf8">
                    {(tone) => (
                        <>
                            {px(22, 5, 1, 1, tone)}
                            {px(24, 5, 1, 1, tone)}
                            {px(26, 5, 1, 1, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        case 'star':
            return (
                <SpeechBubble tone="#facc15">
                    {(tone) => (
                        <>
                            {px(24, 3, 1, 4, tone)}
                            {px(22, 5, 5, 1, tone)}
                            {px(23, 4, 3, 3, tone)}
                        </>
                    )}
                </SpeechBubble>
            );
        default:
            return null;
    }
};

const renderEyes = (expression, sleepy) => {
    if (expression === 'loved') {
        return (
            <>
                {px(11, 14, 1, 1, '#fb7185')}
                {px(12, 13, 1, 1, '#fb7185')}
                {px(13, 14, 1, 1, '#fb7185')}
                {px(12, 15, 1, 1, '#fb7185')}
                {px(19, 14, 1, 1, '#fb7185')}
                {px(20, 13, 1, 1, '#fb7185')}
                {px(21, 14, 1, 1, '#fb7185')}
                {px(20, 15, 1, 1, '#fb7185')}
                {px(10, 17, 2, 1, '#fda4af')}
                {px(21, 17, 2, 1, '#fda4af')}
            </>
        );
    }
    if (sleepy || expression === 'sleepy') {
        return (
            <>
                {px(11, 15, 3, 1, '#0f172a')}
                {px(19, 15, 3, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'laugh') {
        return (
            <>
                {px(11, 14, 3, 1, '#0f172a')}
                {px(19, 14, 3, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'sad') {
        return (
            <>
                {px(11, 14, 3, 1, '#0f172a')}
                {px(20, 14, 3, 1, '#0f172a')}
                {px(21, 15, 1, 1, '#60a5fa')}
            </>
        );
    }
    if (expression === 'curious') {
        return (
            <>
                {px(11, 13, 3, 1, '#0f172a')}
                {px(12, 14, 2, 2, '#0f172a')}
                {px(13, 14, 1, 1, '#ffffff')}
                {px(19, 14, 2, 2, '#0f172a')}
                {px(20, 14, 1, 1, '#ffffff')}
                {px(19, 13, 3, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'surprised') {
        return (
            <>
                {px(12, 14, 2, 3, '#0f172a')}
                {px(19, 14, 2, 3, '#0f172a')}
                {px(13, 15, 1, 1, '#ffffff')}
                {px(20, 15, 1, 1, '#ffffff')}
            </>
        );
    }
    if (expression === 'determined' || expression === 'focus') {
        return (
            <>
                {px(11, 13, 3, 1, '#0f172a')}
                {px(19, 13, 3, 1, '#0f172a')}
                {px(12, 14, 2, 2, '#0f172a')}
                {px(19, 14, 2, 2, '#0f172a')}
                {px(13, 14, 1, 1, '#ffffff')}
                {px(20, 14, 1, 1, '#ffffff')}
            </>
        );
    }
    return (
        <>
            {px(12, 14, 2, 2, '#0f172a')}
            {px(19, 14, 2, 2, '#0f172a')}
            {px(13, 14, 1, 1, '#ffffff')}
            {px(20, 14, 1, 1, '#ffffff')}
        </>
    );
};

const renderMouth = (expression, talking, talkFrame) => {
    if (talking || expression === 'speaking') {
        if (talkFrame % 2 === 0) {
            return (
                <>
                    {px(14, 18, 1, 1, '#0f172a')}
                    {px(15, 18, 4, 2, '#0f172a')}
                    {px(16, 19, 2, 1, '#fca5a5')}
                </>
            );
        }
        return (
            <>
                {px(15, 18, 3, 1, '#0f172a')}
                {px(14, 19, 5, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'happy' || expression === 'loved') {
        return (
            <>
                {px(14, 18, 1, 1, '#0f172a')}
                {px(15, 19, 4, 1, '#0f172a')}
                {px(19, 18, 1, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'laugh') {
        return (
            <>
                {px(14, 18, 6, 3, '#0f172a')}
                {px(15, 19, 4, 1, '#ffffff')}
                {px(16, 20, 2, 1, '#fca5a5')}
            </>
        );
    }
    if (expression === 'sad') {
        return (
            <>
                {px(15, 19, 3, 1, '#0f172a')}
                {px(14, 20, 1, 1, '#0f172a')}
                {px(18, 20, 1, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'surprised') {
        return (
            <>
                {px(16, 18, 2, 3, '#0f172a')}
                {px(16, 19, 2, 1, '#fca5a5')}
            </>
        );
    }
    if (expression === 'curious') {
        return (
            <>
                {px(15, 18, 3, 1, '#0f172a')}
                {px(18, 19, 1, 1, '#0f172a')}
            </>
        );
    }
    if (expression === 'determined' || expression === 'focus') {
        return px(15, 18, 3, 1, '#0f172a');
    }
    return px(15, 18, 3, 1, '#0f172a');
};

const BookfinSprite = ({
    size = 42,
    mood = 'idle',
    expression = 'neutral',
    stage = 'baby',
    cosmetic = 'auto',
    className = '',
    emote = 'none',
    talking = false,
    talkFrame = 0,
}) => {
    const chosenCosmetic = cosmetic === 'auto'
        ? (stage === 'legend' ? 'crown' : stage === 'explorer' ? 'cap' : stage === 'reader' ? 'glasses' : 'none')
        : cosmetic;
    const body = stage === 'legend' ? '#38bdf8' : stage === 'explorer' ? '#22d3ee' : stage === 'reader' ? '#60a5fa' : '#7dd3fc';
    const cover = stage === 'legend' ? '#075985' : '#1d4ed8';
    const accent = mood === 'focus' ? '#22c55e' : mood === 'celebrate' ? '#facc15' : mood === 'curious' ? '#14b8a6' : '#38bdf8';
    const sleepy = mood === 'sleepy';
    const activeExpression = expression === 'neutral'
        ? (mood === 'celebrate' ? 'happy' : mood === 'focus' ? 'determined' : mood === 'curious' ? 'curious' : sleepy ? 'sleepy' : 'neutral')
        : expression;

    return (
        <svg
            className={`sharky-sprite ${className}`}
            width={size}
            height={size}
            viewBox="0 0 32 32"
            role="img"
            aria-label="Sharky pixel mascot"
            shapeRendering="crispEdges">
            <rect width="32" height="32" fill="transparent" />

            {mood === 'celebrate' && <Sparkles />}
            {sleepy && <SleepMarks />}
            {renderEmote(emote)}

            {px(8, 27, 17, 2, 'rgba(2,6,23,0.35)', 'shadow')}

            {px(14, 3, 4, 2, '#0f172a')}
            {px(13, 5, 6, 2, cover)}
            {px(12, 7, 8, 2, body)}
            {px(11, 9, 10, 2, body)}

            {px(4, 14, 4, 3, cover)}
            {px(5, 17, 3, 3, '#0f172a')}
            {px(24, 13, 4, 4, cover)}
            {px(24, 17, 3, 3, '#0f172a')}

            {px(8, 10, 16, 16, '#0f172a')}
            {px(9, 9, 14, 16, body)}
            {px(10, 10, 6, 14, '#e0f2fe')}
            {px(17, 10, 5, 14, '#dbeafe')}
            {px(16, 10, 1, 15, '#2563eb')}
            {px(9, 23, 14, 2, cover)}

            {renderEyes(activeExpression, sleepy)}
            {renderMouth(activeExpression, talking, talkFrame)}

            {px(9, 9, 3, 1, accent)}
            {mood === 'focus' && px(22, 11, 2, 12, '#22c55e')}

            {chosenCosmetic === 'glasses' && (
                <>
                    {px(10, 13, 5, 4, '#0f172a')}
                    {px(18, 13, 5, 4, '#0f172a')}
                    {px(15, 14, 3, 1, '#0f172a')}
                    {px(11, 14, 3, 2, '#bae6fd')}
                    {px(19, 14, 3, 2, '#bae6fd')}
                </>
            )}
            {chosenCosmetic === 'scarf' && (
                <>
                    {px(9, 22, 14, 2, '#ef4444')}
                    {px(21, 24, 2, 4, '#b91c1c')}
                </>
            )}
            {chosenCosmetic === 'cap' && (
                <>
                    {px(10, 7, 12, 2, '#0f172a')}
                    {px(12, 5, 8, 3, '#f97316')}
                    {px(20, 7, 5, 1, '#fb923c')}
                </>
            )}
            {chosenCosmetic === 'crown' && (
                <>
                    {px(10, 5, 3, 3, '#facc15')}
                    {px(15, 3, 3, 5, '#facc15')}
                    {px(20, 5, 3, 3, '#facc15')}
                    {px(10, 8, 13, 2, '#ca8a04')}
                </>
            )}
        </svg>
    );
};

export default BookfinSprite;
